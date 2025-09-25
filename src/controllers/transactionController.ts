import { Request, Response } from 'express';
import { Op } from 'sequelize';
import database_models from '../database/config/db.config';

const { 
  Wallet, 
  Transaction: TransactionModel, 
  Category, 
  WalletRestriction,
  Organization 
} = database_models;

// Helper function to calculate fee
const calculateFee = (amount: number): number => {
  const feePercentage = 0.02;
  const fee = amount * feePercentage;
  const minFee = 5;
  const maxFee = 1000;
  
  return Math.min(Math.max(fee, minFee), maxFee);
};

// Transfer money between users and/or organizations
const transferMoney = async (req: Request, res: Response): Promise<void> => {
  const transaction = await TransactionModel.sequelize?.transaction();
  
  try {
    const {
      senderUserId,
      senderOrganizationId,
      receiverUserId,
      receiverOrganizationId,
      amount,
      description = '',
      categoryId,
      type = 'transfer',
      applyConstraints = false // New parameter to control constraint application
    } = req.body;

    // Validation - must have either user or organization for sender and receiver
    const hasSender = senderUserId || senderOrganizationId;
    const hasReceiver = receiverUserId || receiverOrganizationId;
    
    if (!hasSender || !hasReceiver || !amount) {
      res.status(400).json({
        success: false,
        message: 'Sender (user or organization), receiver (user or organization), and amount are required'
      });
      return;
    }

    // Cannot send to self
    if ((senderUserId && receiverUserId && senderUserId === receiverUserId) ||
        (senderOrganizationId && receiverOrganizationId && senderOrganizationId === receiverOrganizationId)) {
      res.status(400).json({
        success: false,
        message: 'Cannot transfer to yourself'
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

    // Check for duplicate transactions in the last 30 seconds
    const now = new Date();
    const thirtySecondsAgo = new Date(now.getTime() - 30000);
    
    // Build wallet search conditions for sender and receiver
    const senderWhere = senderUserId 
      ? { userId: senderUserId, isActive: true }
      : { organizationId: senderOrganizationId, isActive: true };
    
    const receiverWhere = receiverUserId 
      ? { userId: receiverUserId, isActive: true }
      : { organizationId: receiverOrganizationId, isActive: true };
    
    // First find the wallets to get their IDs
    const [checkSenderWallet, checkReceiverWallet] = await Promise.all([
      Wallet.findOne({ where: senderWhere }),
      Wallet.findOne({ where: receiverWhere })
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

    // Find wallets for both sender and receiver (users or organizations)
    const [senderWallet, receiverWallet] = await Promise.all([
      Wallet.findOne({
        where: senderWhere,
        lock: transaction?.LOCK.UPDATE,
        transaction
      }),
      Wallet.findOne({
        where: receiverWhere,
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

    // Check wallet restrictions and calculate available amounts
    const restrictions = await WalletRestriction.findAll({
      where: { walletId: senderWallet.id },
      include: [{
        model: Category,
        as: 'category',
        required: true
      }],
      transaction
    });

    // Calculate total restricted amount
    const totalRestrictedAmount = restrictions.reduce((sum, restriction) => 
      sum + parseFloat(restriction.amount.toString()), 0
    );
    
    // Calculate available unrestricted amount
    const totalBalance = parseFloat(senderWallet.balance.toString());
    const availableUnrestrictedAmount = totalBalance - totalRestrictedAmount;

    // If spending on a specific category, check constraints
    if (categoryId) {
      const matchingRestriction = restrictions.find(restriction => 
        restriction.categoryId === categoryId
      );

      if (matchingRestriction) {
        // Spending from restricted funds - check if enough is available
        if (matchingRestriction.amount < transferAmount) {
          await transaction?.rollback();
          res.status(400).json({
            success: false,
            message: `Insufficient restricted balance for this category. Available: ${matchingRestriction.amount}, Required: ${transferAmount}`,
            availableAmount: parseFloat(matchingRestriction.amount.toString()),
            requiredAmount: transferAmount
          });
          return;
        }
      } else {
        // Spending on a different category - check if enough unrestricted funds
        if (availableUnrestrictedAmount < transferAmount) {
          await transaction?.rollback();
          const allowedCategories = restrictions.map(r => (r as any).category?.name).join(', ');
          res.status(400).json({
            success: false,
            message: `Insufficient unrestricted balance. Available: ${availableUnrestrictedAmount}, Required: ${transferAmount}. You can spend restricted funds on: ${allowedCategories}`,
            availableUnrestrictedAmount,
            requiredAmount: transferAmount,
            allowedCategories: restrictions.map(r => ({
              categoryId: r.categoryId,
              categoryName: (r as any).category?.name,
              availableAmount: parseFloat(r.amount.toString())
            }))
          });
          return;
        }
      }
    } else {
      // No category specified - check if enough unrestricted funds
      if (availableUnrestrictedAmount < transferAmount) {
        await transaction?.rollback();
        const allowedCategories = restrictions.map(r => (r as any).category?.name).join(', ');
        res.status(400).json({
          success: false,
          message: `Insufficient unrestricted balance. Available: ${availableUnrestrictedAmount}, Required: ${transferAmount}. You can spend restricted funds on: ${allowedCategories}`,
          availableUnrestrictedAmount,
          requiredAmount: transferAmount,
          allowedCategories: restrictions.map(r => ({
            categoryId: r.categoryId,
            categoryName: (r as any).category?.name,
            availableAmount: parseFloat(r.amount.toString())
          }))
        });
        return;
      }
    }

    // Verify category if provided
    if (categoryId) {
      const category = await Category.findByPk(categoryId);
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

    // Determine constraint type
    const spendConstraintType = applyConstraints && categoryId ? 'category' : 'none';
    const constraintCategoryId = applyConstraints && categoryId ? categoryId : null;

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
      spendConstraintType,
      constraintCategoryId,
      hasAccount: true
    } as any, { transaction });

    // Create wallet restriction if constraints are applied
    if (applyConstraints && categoryId) {
      // Check if restriction already exists for this wallet and category
      const existingRestriction = await WalletRestriction.findOne({
        where: {
          walletId: receiverWallet.id,
          categoryId: categoryId
        },
        transaction
      });

      if (existingRestriction) {
        // Update existing restriction amount
        await existingRestriction.update({
          amount: parseFloat(existingRestriction.amount.toString()) + transferAmount
        }, { transaction });
      } else {
        // Create new restriction
        await WalletRestriction.create({
          walletId: receiverWallet.id,
          categoryId: categoryId,
          amount: transferAmount
        }, { transaction });
      }
    }

    // Update wallet restrictions for sender based on spending source
    if (categoryId) {
      const matchingRestriction = restrictions.find(restriction => 
        restriction.categoryId === categoryId
      );

      if (matchingRestriction) {
        // Spending from restricted funds - reduce the restriction
        const newAmount = parseFloat(matchingRestriction.amount.toString()) - transferAmount;
        if (newAmount <= 0) {
          // Remove restriction if amount is zero or negative
          await matchingRestriction.destroy({ transaction });
        } else {
          // Update restriction amount
          await matchingRestriction.update({ amount: newAmount }, { transaction });
        }
      }
      // If no matching restriction, we're spending from unrestricted funds - no restriction updates needed
    } else {
      // No category specified - spending from unrestricted funds - no restriction updates needed
    }

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
        senderUserId: senderUserId || null,
        senderOrganizationId: senderOrganizationId || null,
        receiverUserId: receiverUserId || null,
        receiverOrganizationId: receiverOrganizationId || null,
        description,
        categoryId,
        spendConstraintType,
        constraintCategoryId,
        constraintsApplied: applyConstraints,
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

    // Validate walletId
    if (!walletId || walletId === 'undefined' || walletId === 'null') {
      res.status(400).json({
        success: false,
        message: 'Valid walletId is required'
      });
      return;
    }

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
    
    // Validate walletId
    if (!walletId || walletId === 'undefined' || walletId === 'null') {
      res.status(400).json({
        success: false,
        message: 'Valid walletId is required'
      });
      return;
    }
    
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
          model: Category,
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
          model: Category,
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

// Get all categories
const getTransactionCategories = async (req: Request, res: Response): Promise<void> => {
  try {
    const categories = await Category.findAll({
      where: {
        isActive: true
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

// Get organization's wallet information
const getOrganizationWallet = async (req: Request, res: Response): Promise<void> => {
  try {
    const { organizationId } = req.params;

    const wallet = await Wallet.findOne({
      where: { organizationId, isActive: true }
    });

    if (!wallet) {
      res.status(404).json({
        success: false,
        message: 'Active wallet not found for this organization'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        walletId: wallet.id,
        organizationId: wallet.organizationId,
        balance: parseFloat(wallet.balance.toString()),
        currency: wallet.currency,
        isActive: wallet.isActive
      }
    });

  } catch (error) {
    console.error('Get organization wallet error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get wallet restrictions
const getWalletRestrictions = async (req: Request, res: Response): Promise<void> => {
  try {
    const { walletId } = req.params;

    // Validate walletId
    if (!walletId || walletId === 'undefined' || walletId === 'null') {
      res.status(400).json({
        success: false,
        message: 'Valid walletId is required'
      });
      return;
    }

    const restrictions = await WalletRestriction.findAll({
      where: { walletId },
      include: [{
        model: Category,
        as: 'category',
        required: true
      }],
      order: [['createdAt', 'DESC']]
    });

    res.status(200).json({
      success: true,
      data: restrictions.map(restriction => ({
        id: restriction.id,
        walletId: restriction.walletId,
        categoryId: restriction.categoryId,
        categoryName: (restriction as any).category?.name,
        categoryDescription: (restriction as any).category?.description,
        amount: parseFloat(restriction.amount.toString()),
        createdAt: (restriction as any).createdAt,
        updatedAt: (restriction as any).updatedAt
      }))
    });

  } catch (error) {
    console.error('Get wallet restrictions error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get wallet balance breakdown (restricted vs unrestricted)
const getWalletBalanceBreakdown = async (req: Request, res: Response): Promise<void> => {
  try {
    const { walletId } = req.params;

    // Validate walletId
    if (!walletId || walletId === 'undefined' || walletId === 'null') {
      res.status(400).json({
        success: false,
        message: 'Valid walletId is required'
      });
      return;
    }

    const wallet = await Wallet.findByPk(walletId);
    if (!wallet) {
      res.status(404).json({
        success: false,
        message: 'Wallet not found'
      });
      return;
    }

    const restrictions = await WalletRestriction.findAll({
      where: { walletId },
      include: [{
        model: Category,
        as: 'category',
        required: true
      }],
      order: [['createdAt', 'DESC']]
    });

    const totalBalance = parseFloat(wallet.balance.toString());
    const totalRestrictedAmount = restrictions.reduce((sum, restriction) => 
      sum + parseFloat(restriction.amount.toString()), 0
    );
    const availableUnrestrictedAmount = totalBalance - totalRestrictedAmount;

    res.status(200).json({
      success: true,
      data: {
        walletId: wallet.id,
        totalBalance,
        availableUnrestrictedAmount,
        totalRestrictedAmount,
        restrictions: restrictions.map(restriction => ({
          id: restriction.id,
          categoryId: restriction.categoryId,
          categoryName: (restriction as any).category?.name,
          categoryDescription: (restriction as any).category?.description,
          amount: parseFloat(restriction.amount.toString())
        }))
      }
    });

  } catch (error) {
    console.error('Get wallet balance breakdown error:', error);
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
  getOrganizationWallet,
  getTransactionHistory,
  getTransactionDetails,
  getTransactionCategories,
  getWalletRestrictions,
  getWalletBalanceBreakdown
};