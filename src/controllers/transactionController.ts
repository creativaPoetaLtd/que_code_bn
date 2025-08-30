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
      senderWalletId,
      receiverWalletId,
      amount,
      description = '',
      categoryId,
      type = 'transfer'
    } = req.body;

    // Validation
    if (!senderWalletId || !receiverWalletId || !amount) {
      res.status(400).json({
        success: false,
        message: 'Sender wallet ID, receiver wallet ID, and amount are required'
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

    if (senderWalletId === receiverWalletId) {
      res.status(400).json({
        success: false,
        message: 'Cannot transfer to the same wallet'
      });
      return;
    }

    // Calculate fee and total amount
    const transferAmount = parseFloat(amount);
    //const fee = calculateFee(transferAmount);
    //fee not needed for now
    const fee = 0;
    const totalAmount = transferAmount + fee;

    // Lock both wallets to prevent race conditions
    const [senderWallet, receiverWallet] = await Promise.all([
      Wallet.findByPk(senderWalletId, {
        lock: transaction?.LOCK.UPDATE,
        transaction
      }),
      Wallet.findByPk(receiverWalletId, {
        lock: transaction?.LOCK.UPDATE,
        transaction
      })
    ]);

    // Check if wallets exist
    if (!senderWallet) {
      await transaction?.rollback();
      res.status(404).json({
        success: false,
        message: 'Sender wallet not found'
      });
      return;
    }

    if (!receiverWallet) {
      await transaction?.rollback();
      res.status(404).json({
        success: false,
        message: 'Receiver wallet not found'
      });
      return;
    }

    // Check if wallets are active
    if (!senderWallet.isActive) {
      await transaction?.rollback();
      res.status(400).json({
        success: false,
        message: 'Sender wallet is not active'
      });
      return;
    }

    if (!receiverWallet.isActive) {
      await transaction?.rollback();
      res.status(400).json({
        success: false,
        message: 'Receiver wallet is not active'
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

    // Update wallet balances
    await senderWallet.update({
      balance: senderWallet.balance - totalAmount
    }, { transaction });

    await receiverWallet.update({
      balance: receiverWallet.balance + transferAmount
    }, { transaction });

    // Create transaction record
    const newTransaction = await TransactionModel.create({
      referenceId,
      senderWalletId,
      receiverWalletId,
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
        senderBalance: senderWallet.balance - totalAmount,
        receiverBalance: receiverWallet.balance + transferAmount,
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
        balance: wallet.balance,
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

export default {
  transferMoney,
  getWalletBalance,
  getTransactionHistory,
  getTransactionDetails,
  getTransactionCategories
};