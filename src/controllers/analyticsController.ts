import { Request, Response } from 'express';
import { Op } from 'sequelize';
import database_models from '../database/config/db.config';
import { sequelizeConnection } from '../database/config/db.config';

const { Wallet, Transaction: TransactionModel, Category } = database_models;

// GET /api/analytics/summary - Get expense summary
const getExpenseSummary = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, startDate, endDate } = req.query;
    
    if (!userId || typeof userId !== 'string') {
      res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
      return;
    }

    // Get user's wallet
    const wallet = await Wallet.findOne({
      where: { userId: userId as string, isActive: true }
    });

    if (!wallet) {
      res.status(404).json({
        success: false,
        message: 'Wallet not found'
      });
      return;
    }

    // Build date filter
    const dateFilter: any = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt[Op.gte] = new Date(startDate as string);
      if (endDate) dateFilter.createdAt[Op.lte] = new Date(endDate as string);
    }

    // Get income (money received)
    const incomeResult = await TransactionModel.findOne({
      where: {
        receiverWalletId: wallet.id,
        status: 'completed',
        ...dateFilter
      },
      attributes: [
        [sequelizeConnection.fn('SUM', sequelizeConnection.col('amount')), 'totalIncome'],
        [sequelizeConnection.fn('COUNT', sequelizeConnection.col('id')), 'incomeCount']
      ],
      raw: true
    }) as any;

    // Get expenses (money sent)
    const expenseResult = await TransactionModel.findOne({
      where: {
        senderWalletId: wallet.id,
        status: 'completed',
        ...dateFilter
      },
      attributes: [
        [sequelizeConnection.fn('SUM', sequelizeConnection.col('amount')), 'totalExpenses'],
        [sequelizeConnection.fn('COUNT', sequelizeConnection.col('id')), 'expenseCount']
      ],
      raw: true
    }) as any;

    const totalIncome = parseFloat(incomeResult?.totalIncome || '0');
    const totalExpenses = parseFloat(expenseResult?.totalExpenses || '0');
    const incomeCount = parseInt(incomeResult?.incomeCount || '0');
    const expenseCount = parseInt(expenseResult?.expenseCount || '0');

    res.status(200).json({
      success: true,
      data: {
        totalIncome,
        totalExpenses,
        netBalance: totalIncome - totalExpenses,
        currentBalance: parseFloat(wallet.balance.toString()),
        transactionCount: incomeCount + expenseCount,
        incomeCount,
        expenseCount
      }
    });
  } catch (error) {
    console.error('Get expense summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// GET /api/analytics/category-breakdown - Get expense breakdown by categories
const getCategoryBreakdown = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, startDate, endDate } = req.query;
    
    if (!userId || typeof userId !== 'string') {
      res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
      return;
    }

    // Get user's wallet
    const wallet = await Wallet.findOne({
      where: { userId: userId as string, isActive: true }
    });

    if (!wallet) {
      res.status(404).json({
        success: false,
        message: 'Wallet not found'
      });
      return;
    }

    // Build date filter
    const dateFilter: any = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt[Op.gte] = new Date(startDate as string);
      if (endDate) dateFilter.createdAt[Op.lte] = new Date(endDate as string);
    }

    // Get expense breakdown by category
    const categoryBreakdown = await TransactionModel.findAll({
      where: {
        senderWalletId: wallet.id,
        status: 'completed',
        ...dateFilter
      },
      include: [
        {
          model: Category,
          as: 'category',
          attributes: ['id', 'name', 'description']
        }
      ],
      attributes: [
        'categoryId',
        [sequelizeConnection.fn('SUM', sequelizeConnection.col('amount')), 'totalAmount'],
        [sequelizeConnection.fn('COUNT', sequelizeConnection.col('Transaction.id')), 'transactionCount']
      ],
      group: ['categoryId', 'category.id', 'category.name', 'category.description'],
      order: [[sequelizeConnection.fn('SUM', sequelizeConnection.col('amount')), 'DESC']],
      raw: false
    }) as any[];

    // Format the response
    const formattedBreakdown = categoryBreakdown.map((item: any) => ({
      categoryId: item.categoryId,
      categoryName: item.category?.name || 'Uncategorized',
      categoryDescription: item.category?.description || '',
      totalAmount: parseFloat(item.dataValues?.totalAmount || item.totalAmount || '0'),
      transactionCount: parseInt(item.dataValues?.transactionCount || item.transactionCount || '0'),
      percentage: 0 // Will calculate after getting total
    }));

    // Calculate total for percentages
    const total = formattedBreakdown.reduce((sum, item) => sum + item.totalAmount, 0);
    
    // Add percentages
    formattedBreakdown.forEach(item => {
      item.percentage = total > 0 ? Number(((item.totalAmount / total) * 100).toFixed(2)) : 0;
    });

    res.status(200).json({
      success: true,
      data: formattedBreakdown
    });
  } catch (error) {
    console.error('Get category breakdown error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// GET /api/analytics/spending-trends - Get spending trends over time
const getSpendingTrends = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, startDate, endDate, interval = 'daily' } = req.query;
    
    if (!userId || typeof userId !== 'string') {
      res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
      return;
    }

    // Get user's wallet
    const wallet = await Wallet.findOne({
      where: { userId: userId as string, isActive: true }
    });

    if (!wallet) {
      res.status(404).json({
        success: false,
        message: 'Wallet not found'
      });
      return;
    }

    // Set default date range (last 30 days if not specified)
    const endDateTime = endDate ? new Date(endDate as string) : new Date();
    const startDateTime = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Determine date format based on interval
    let dateFormat: string;
    let dateGroupBy: any;
    
    switch (interval) {
      case 'weekly':
        dateFormat = '%Y-%u'; // Year-Week
        dateGroupBy = sequelizeConnection.fn('DATE_TRUNC', 'week', sequelizeConnection.col('createdAt'));
        break;
      case 'monthly':
        dateFormat = '%Y-%m'; // Year-Month
        dateGroupBy = sequelizeConnection.fn('DATE_TRUNC', 'month', sequelizeConnection.col('createdAt'));
        break;
      default: // daily
        dateFormat = '%Y-%m-%d'; // Year-Month-Day
        dateGroupBy = sequelizeConnection.fn('DATE_TRUNC', 'day', sequelizeConnection.col('createdAt'));
        break;
    }

    // Get spending trends (expenses)
    const spendingTrends = await TransactionModel.findAll({
      where: {
        senderWalletId: wallet.id,
        status: 'completed',
        createdAt: {
          [Op.gte]: startDateTime,
          [Op.lte]: endDateTime
        }
      },
      attributes: [
        [dateGroupBy, 'date'],
        [sequelizeConnection.fn('SUM', sequelizeConnection.col('amount')), 'totalSpent'],
        [sequelizeConnection.fn('COUNT', sequelizeConnection.col('id')), 'transactionCount']
      ],
      group: [dateGroupBy],
      order: [[dateGroupBy, 'ASC']],
      raw: true
    }) as any[];

    // Get income trends
    const incomeTrends = await TransactionModel.findAll({
      where: {
        receiverWalletId: wallet.id,
        status: 'completed',
        createdAt: {
          [Op.gte]: startDateTime,
          [Op.lte]: endDateTime
        }
      },
      attributes: [
        [dateGroupBy, 'date'],
        [sequelizeConnection.fn('SUM', sequelizeConnection.col('amount')), 'totalReceived'],
        [sequelizeConnection.fn('COUNT', sequelizeConnection.col('id')), 'transactionCount']
      ],
      group: [dateGroupBy],
      order: [[dateGroupBy, 'ASC']],
      raw: true
    }) as any[];

    // Combine and format the data
    const trendsMap = new Map();
    
    // Add spending data
    spendingTrends.forEach((item: any) => {
      const dateKey = new Date(item.date).toISOString().split('T')[0];
      trendsMap.set(dateKey, {
        date: dateKey,
        totalSpent: parseFloat(item.totalSpent || '0'),
        totalReceived: 0,
        spentCount: parseInt(item.transactionCount || '0'),
        receivedCount: 0,
        netFlow: 0
      });
    });

    // Add income data
    incomeTrends.forEach((item: any) => {
      const dateKey = new Date(item.date).toISOString().split('T')[0];
      const existing = trendsMap.get(dateKey);
      if (existing) {
        existing.totalReceived = parseFloat(item.totalReceived || '0');
        existing.receivedCount = parseInt(item.transactionCount || '0');
      } else {
        trendsMap.set(dateKey, {
          date: dateKey,
          totalSpent: 0,
          totalReceived: parseFloat(item.totalReceived || '0'),
          spentCount: 0,
          receivedCount: parseInt(item.transactionCount || '0'),
          netFlow: 0
        });
      }
    });

    // Calculate net flow and convert to array
    const trends = Array.from(trendsMap.values()).map(item => ({
      ...item,
      netFlow: item.totalReceived - item.totalSpent
    })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    res.status(200).json({
      success: true,
      data: trends
    });
  } catch (error) {
    console.error('Get spending trends error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// GET /api/analytics/recent-transactions - Get recent transactions with categories
const getRecentTransactions = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, limit = '10', type } = req.query;
    
    if (!userId || typeof userId !== 'string') {
      res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
      return;
    }

    // Get user's wallet
    const wallet = await Wallet.findOne({
      where: { userId: userId as string, isActive: true }
    });

    if (!wallet) {
      res.status(404).json({
        success: false,
        message: 'Wallet not found'
      });
      return;
    }

    const limitNum = parseInt(limit as string) || 10;

    // Build where condition based on type
    let whereCondition: any = {
      status: 'completed'
    };

    if (type === 'sent') {
      whereCondition.senderWalletId = wallet.id;
    } else if (type === 'received') {
      whereCondition.receiverWalletId = wallet.id;
    } else {
      // Both sent and received
      whereCondition[Op.or] = [
        { senderWalletId: wallet.id },
        { receiverWalletId: wallet.id }
      ];
    }

    // Get recent transactions
    const transactions = await TransactionModel.findAll({
      where: whereCondition,
      include: [
        {
          model: Category,
          as: 'category',
          attributes: ['id', 'name', 'description']
        },
        {
          model: Wallet,
          as: 'senderWallet',
          attributes: ['id', 'userId']
        },
        {
          model: Wallet,
          as: 'receiverWallet',
          attributes: ['id', 'userId']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: limitNum
    });

    // Format the response
    const formattedTransactions = transactions.map((transaction: any) => {
      const isSent = transaction.senderWalletId === wallet.id;
      
      return {
        id: transaction.id,
        referenceId: transaction.referenceId,
        amount: parseFloat(transaction.amount.toString()),
        type: isSent ? 'sent' : 'received',
        status: transaction.status,
        description: transaction.description,
        createdAt: transaction.createdAt,
        category: transaction.category ? {
          id: transaction.category.id,
          name: transaction.category.name,
          description: transaction.category.description
        } : null,
        otherParty: {
          walletId: isSent ? transaction.receiverWalletId : transaction.senderWalletId,
          userId: isSent ? transaction.receiverWallet?.userId : transaction.senderWallet?.userId
        }
      };
    });

    res.status(200).json({
      success: true,
      data: formattedTransactions
    });
  } catch (error) {
    console.error('Get recent transactions error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

export default {
  getExpenseSummary,
  getCategoryBreakdown,
  getSpendingTrends,
  getRecentTransactions
};
