import { Request, Response } from 'express';
import { Op } from 'sequelize';
import database_models from '../database/config/db.config';

const { Wallet, Transaction: TransactionModel, TransactionCategory } = database_models;

// Helper function to calculate fee
const calculateFee = (amount: number): number => {
  const feePercentage = 0.02;
  const fee = amount * feePercentage;
  const minFee = 5;
  const maxFee = 1000;
  
  return Math.min(Math.max(fee, minFee), maxFee);
};

// Transfer money between users
const transferMoney = async (req: Request, res: Response): Promise<void> => {
  const transaction = await TransactionModel.sequelize?.transaction();
  
  try {
    const {
      senderUserId,
      receiverUserId,
      amount,
      description = '',
      categoryId,
      type = 'transfer'
    } = req.body;

    // Validation
    if (!senderUserId || !receiverUserId || !amount) {
      res.status(400).json({
        success: false,
        message: 'Sender user ID, receiver user ID, and amount are required'
      });
      return;
    }

    if (amount <= 0) {
      res.status(400).json({
        success: false,
        message: 'Amount must be greater than 0'
      });
      return;
    }

    if (senderUserId === receiverUserId) {
      res.status(400).json({
        success: false,
        message: 'Cannot transfer to yourself'
      });
      return;
    }

    // Check for duplicate transactions in the last 30 seconds
    const now = new Date();
    const thirtySecondsAgo = new Date(now.getTime() - 30000);
    
    // First find the wallets to get their IDs
    const [checkSenderWallet, checkReceiverWallet] = await Promise.all([
      Wallet.findOne({ where: { userId: senderUserId, isActive: true } }),
      Wallet.findOne({ where: { userId: receiverUserId, isActive: true } })
    ]);

    if (checkSenderWallet && checkReceiverWallet) {
      const recentTransaction = await TransactionModel.findOne({
        where: {
          senderWalletId: checkSenderWallet.id,
          receiverWalletId: checkReceiverWallet.id,
          amount: parseFloat(amount),
          createdAt: {
            [Op.gte]: thirtySecondsAgo
          },
          status: 'completed'
        },
        order: [['createdAt', 'DESC']]
      });

      if (recentTransaction) {
        await transaction?.rollback();
        res.status(400).json({
          success: false,
          message: 'Duplicate transaction detected. Please wait before making another similar transfer.'
        });
        return;
      }
    }

    // Calculate fee and total amount
    const transferAmount = parseFloat(amount);
    //const fee = calculateFee(transferAmount);
    //fee not needed for now
    const fee = 0;
    const totalAmount = transferAmount + fee;

    // Find wallets for both users
    const [senderWallet, receiverWallet] = await Promise.all([
      Wallet.findOne({
        where: { userId: senderUserId, isActive: true },
        lock: transaction?.LOCK.UPDATE,
        transaction
      }),
      Wallet.findOne({
        where: { userId: receiverUserId, isActive: true },
        lock: transaction?.LOCK.UPDATE,
        transaction
      })
    ]);

    // Check if wallets exist
    if (!senderWallet) {
      await transaction?.rollback();
      res.status(404).json({
        success: false,
        message: 'Sender wallet not found or inactive'
      });
      return;
    }

    if (!receiverWallet) {
      await transaction?.rollback();
      res.status(404).json({
        success: false,
        message: 'Receiver wallet not found or inactive'
      });
      return;
    }

    // Check sufficient balance
    if (senderWallet.balance < totalAmount) {
      await transaction?.rollback();
      res.status(400).json({
        success: false,
        message: 'Insufficient balance'
      });
      return;
    }

    // Verify category if provided
    if (categoryId) {
      const category = await TransactionCategory.findByPk(categoryId);
      if (!category) {
        await transaction?.rollback();
        res.status(400).json({
          success: false,
          message: 'Invalid category ID'
        });
        return;
      }
    }

    // Generate reference ID
    const referenceId = `TXN${Date.now()}${Math.floor(Math.random() * 1000)}`;

    // Store original balances before updates for response
    const originalSenderBalance = parseFloat(senderWallet.balance.toString());
    const originalReceiverBalance = parseFloat(receiverWallet.balance.toString());
    
    // Update wallet balances
    await senderWallet.update({
      balance: originalSenderBalance - totalAmount
    }, { transaction });

    const hey = await receiverWallet.update({
      balance: originalReceiverBalance + transferAmount
    }, { transaction });

    // Refresh the wallet instances to get updated values
    await senderWallet.reload({ transaction });
    await receiverWallet.reload({ transaction });

    // Create transaction record
    const newTransaction = await TransactionModel.create({
      referenceId,
      senderWalletId: senderWallet.id,
      receiverWalletId: receiverWallet.id,
      amount: transferAmount,
      fee,
      totalAmount,
      currency: senderWallet.currency,
      status: 'completed',
      type,
      description,
      categoryId,
      spendConstraintType: 'none',
      hasAccount: true
    } as any, { transaction });

    // Commit the transaction
    await transaction?.commit();

    // Return success response
    res.status(200).json({
      success: true,
      message: 'Transfer completed successfully',
      data: {
        transactionId: newTransaction.id,
        referenceId: newTransaction.referenceId,
        amount: transferAmount,
        fee,
        totalAmount,
        senderBalance: senderWallet.balance,
        receiverUserId,
        description,
        categoryId,
        status: 'completed'
      }
    });

  } catch (error) {
    // Rollback transaction on error
    if (transaction) {
      await transaction.rollback();
    }
    
    console.error('Transfer error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during transfer'
    });
  }
};

// Get wallet balance
const getWalletBalance = async (req: Request, res: Response): Promise<void> => {
  try {
    const { walletId } = req.params;

    const wallet = await Wallet.findByPk(walletId);

    if (!wallet) {
      res.status(404).json({
        success: false,
        message: 'Wallet not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        walletId: wallet.id,
        balance: parseFloat(wallet.balance.toString()),
        currency: wallet.currency,
        isActive: wallet.isActive
      }
    });

  } catch (error) {
    console.error('Get balance error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get transaction history for a wallet
const getTransactionHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { walletId } = req.params;
    const { 
      page = 1, 
      limit = 10, 
      type, 
      status,
      startDate,
      endDate 
    } = req.query;

    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
    
    // Build where clause
    const whereClause: any = {
      [Op.or]: [
        { senderWalletId: walletId },
        { receiverWalletId: walletId }
      ]
    };

    if (type) {
      whereClause.type = type;
    }

    if (status) {
      whereClause.status = status;
    }

    if (startDate && endDate) {
      whereClause.createdAt = {
        [Op.between]: [new Date(startDate as string), new Date(endDate as string)]
      };
    }

    const { count, rows: transactions } = await TransactionModel.findAndCountAll({
      where: whereClause,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit as string),
      offset,
      include: [
        {
          model: TransactionCategory,
          as: 'category',
          required: false
        },
        {
          model: Wallet,
          as: 'senderWallet',
          attributes: ['id', 'userId', 'currency']
        },
        {
          model: Wallet,
          as: 'receiverWallet',
          attributes: ['id', 'userId', 'currency']
        }
      ]
    });

    res.status(200).json({
      success: true,
      data: {
        transactions,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total: count,
          totalPages: Math.ceil(count / parseInt(limit as string))
        }
      }
    });

  } catch (error) {
    console.error('Get transaction history error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get single transaction details
const getTransactionDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    const { transactionId } = req.params;

    const transaction = await TransactionModel.findByPk(transactionId, {
      include: [
        {
          model: TransactionCategory,
          as: 'category',
          required: false
        },
        {
          model: Wallet,
          as: 'senderWallet',
          attributes: ['id', 'userId', 'currency']
        },
        {
          model: Wallet,
          as: 'receiverWallet',
          attributes: ['id', 'userId', 'currency']
        }
      ]
    });

    if (!transaction) {
      res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: transaction
    });

  } catch (error) {
    console.error('Get transaction details error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get all transaction categories
const getTransactionCategories = async (req: Request, res: Response): Promise<void> => {
  try {
    const categories = await TransactionCategory.findAll({
      where: {
        isRestricted: false
      },
      order: [['name', 'ASC']]
    });

    res.status(200).json({
      success: true,
      data: categories
    });

  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get user's wallet information
const getUserWallet = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    const wallet = await Wallet.findOne({
      where: { userId, isActive: true }
    });

    if (!wallet) {
      res.status(404).json({
        success: false,
        message: 'Active wallet not found for this user'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        walletId: wallet.id,
        userId: wallet.userId,
        balance: parseFloat(wallet.balance.toString()),
        currency: wallet.currency,
        isActive: wallet.isActive
      }
    });

  } catch (error) {
    console.error('Get user wallet error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

export default {
  transferMoney,
  getWalletBalance,
  getUserWallet,
  getTransactionHistory,
  getTransactionDetails,
  getTransactionCategories
};