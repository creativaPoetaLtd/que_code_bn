import { Request, Response } from 'express';
import { Op } from 'sequelize';
import database_models from '../database/config/db.config';
import { sequelizeConnection } from '../database/config/db.config';
import Models from '../database/models';

const models = Models(sequelizeConnection);
const { Wallet, Transaction: TransactionModel, Category, User } = database_models;

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
    const { userId, startDate, endDate, type = 'expenses' } = req.query;
    
    if (!userId || typeof userId !== 'string') {
      res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
      return;
    }

    // Validate type parameter
    if (type !== 'expenses' && type !== 'income') {
      res.status(400).json({
        success: false,
        message: 'Type must be either "expenses" or "income"'
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

    // Build query based on type (expenses = sent, income = received)
    const whereClause: any = {
      status: 'completed',
      ...dateFilter
    };

    if (type === 'expenses') {
      whereClause.senderWalletId = wallet.id;
    } else {
      whereClause.receiverWalletId = wallet.id;
    }

    // Get category breakdown
    const categoryBreakdown = await TransactionModel.findAll({
      where: whereClause,
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
    const { userId, limit = '10', type, startDate, endDate } = req.query;
    
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

    // Build date filter (optional)
    const dateFilter: any = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt[Op.gte] = new Date(startDate as string);
      if (endDate) dateFilter.createdAt[Op.lte] = new Date(endDate as string);
    }

    // Build where condition based on type
    let whereCondition: any = {
      status: 'completed',
      ...dateFilter
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

// GET /api/analytics/category-transactions - Get transactions for a specific category
const getCategoryTransactions = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, categoryId, startDate, endDate, limit = '10' } = req.query;

    if (!userId || typeof userId !== 'string') {
      res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
      return;
    }

    if (!categoryId || typeof categoryId !== 'string') {
      res.status(400).json({
        success: false,
        message: 'Category ID is required'
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

    const limitNum = parseInt(limit as string) || 10;

    // Get transactions for the specific category (only expenses/sent transactions)
    const transactions = await TransactionModel.findAll({
      where: {
        senderWalletId: wallet.id,
        categoryId: categoryId as string,
        status: 'completed',
        ...dateFilter
      },
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
          attributes: ['id', 'userId'],
          include: [
            {
              model: models.User,
              as: 'user',
              attributes: ['firstName', 'lastName']
            }
          ]
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: limitNum,
    });

    // Format the response (all transactions are sent/expenses for category breakdown)
    const formattedTransactions = transactions.map((transaction: any) => {
      return {
      id: transaction.id,
      referenceId: transaction.referenceId,
      amount: parseFloat(transaction.amount.toString()),
      type: 'sent' as const,
      status: transaction.status,
      description: transaction.description,
      createdAt: transaction.createdAt,
      category: transaction.category ? {
        id: transaction.category.id,
        name: transaction.category.name,
        description: transaction.category.description
      } : null,
      otherParty: {
        walletId: transaction.receiverWalletId,
        userId: transaction.receiverWallet?.userId,
        firstName: transaction.receiverWallet?.user?.firstName,
        lastName: transaction.receiverWallet?.user?.lastName
      }
    }});

    res.status(200).json({
      success: true,
      data: formattedTransactions
    });
  } catch (error) {
    console.error('Get category transactions error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

const getSpendingComparison = async (req: Request, res: Response): Promise<void> => {
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

    // Set current period date range
    const currentEndDate = endDate ? new Date(endDate as string) : new Date();
    const currentStartDate = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Calculate previous period (same duration as current period)
    const periodDuration = currentEndDate.getTime() - currentStartDate.getTime();
    const previousEndDate = new Date(currentStartDate.getTime() - 1); // 1ms before current start
    const previousStartDate = new Date(previousEndDate.getTime() - periodDuration);

    // Determine date format and grouping based on interval
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

    // Helper function to fetch spending data for a period
    const fetchSpendingData = async (start: Date, end: Date) => {
      return await TransactionModel.findAll({
        where: {
          senderWalletId: wallet.id,
          status: 'completed',
          createdAt: {
            [Op.gte]: start,
            [Op.lte]: end
          }
        },
        attributes: [
          [dateGroupBy, 'date'],
          [sequelizeConnection.fn('SUM', sequelizeConnection.col('amount')), 'totalSpent']
        ],
        group: [dateGroupBy],
        order: [[dateGroupBy, 'ASC']],
        raw: true
      }) as any[];
    };

    // Fetch data for both periods
    const [currentPeriodData, previousPeriodData] = await Promise.all([
      fetchSpendingData(currentStartDate, currentEndDate),
      fetchSpendingData(previousStartDate, previousEndDate)
    ]);

    // Format data for chart consumption
    const formatPeriodData = (data: any[], periodLabel: string) => {
      return data.map((item: any) => ({
        label: new Date(item.date).toISOString().split('T')[0], // Format as YYYY-MM-DD
        amount: parseFloat(item.totalSpent || '0')
      }));
    };

    const currentData = formatPeriodData(currentPeriodData, 'current');
    const previousData = formatPeriodData(previousPeriodData, 'previous');

    // Calculate totals
    const currentTotal = currentData.reduce((sum, item) => sum + item.amount, 0);
    const previousTotal = previousData.reduce((sum, item) => sum + item.amount, 0);

    // Calculate percentage change
    const percentageChange = previousTotal > 0
      ? Math.round(((currentTotal - previousTotal) / previousTotal) * 100 * 100) / 100 // Round to 2 decimal places
      : 0;

    res.status(200).json({
      success: true,
      data: {
        currentPeriod: {
          data: currentData,
          total: currentTotal
        },
        previousPeriod: {
          data: previousData,
          total: previousTotal
        },
        percentageChange,
        periodInfo: {
          current: {
            startDate: currentStartDate.toISOString(),
            endDate: currentEndDate.toISOString()
          },
          previous: {
            startDate: previousStartDate.toISOString(),
            endDate: previousEndDate.toISOString()
          },
          interval
        }
      }
    });
  } catch (error) {
    console.error('Get spending comparison error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// GET /api/analytics/period-summary - Get accurate period balances and transactions
const getAnalyticsPeriodSummary = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, startDate, endDate, interval = 'daily' } = req.query;

    // Validate required parameters
    if (!userId || typeof userId !== 'string') {
      res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
      return;
    }

    if (!startDate || !endDate) {
      res.status(400).json({
        success: false,
        message: 'Start date and end date are required'
      });
      return;
    }

    if (
      interval !== 'daily' &&
      interval !== 'weekly' &&
      interval !== 'monthly'
    ) {
      res.status(400).json({
        success: false,
        message: "Interval must be 'daily', 'weekly', or 'monthly'"
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

    // Parse dates
    const startDateTime = new Date(startDate as string);
    const endDateTime = new Date(endDate as string);

    // Validate dates
    if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
      res.status(400).json({
        success: false,
        message: 'Invalid date format'
      });
      return;
    }

    if (startDateTime > endDateTime) {
      res.status(400).json({
        success: false,
        message: 'Start date must be before end date'
      });
      return;
    }

    // Fetch all transactions in the period
    const transactions = await TransactionModel.findAll({
      where: {
        [Op.or]: [
          { senderWalletId: wallet.id },
          { receiverWalletId: wallet.id }
        ],
        status: 'completed',
        createdAt: {
          [Op.gte]: startDateTime,
          [Op.lte]: endDateTime
        }
      },
      order: [['createdAt', 'DESC']]
    });

    // Aggregate transactions by period
    const aggregatedPeriods = await aggregateTransactionsByPeriod(
      transactions,
      wallet.id,
      interval as 'daily' | 'weekly' | 'monthly'
    );

    // Calculate starting balance for each period and build final response
    const periods = [];

    for (const period of aggregatedPeriods) {
      const periodStartDate = new Date(period.date);
      
      // Calculate starting balance at the beginning of this period
      const startingBalance = await calculateWalletBalanceAtDate(
        wallet.id,
        periodStartDate
      );

      // Calculate ending balance
      const endingBalance = startingBalance + period.income - period.expenses;

      periods.push({
        date: period.date,
        periodLabel: period.periodLabel,
        startingBalance: Math.round(startingBalance * 100) / 100, // Round to 2 decimals
        income: Math.round(period.income * 100) / 100,
        expenses: Math.round(period.expenses * 100) / 100,
        endingBalance: Math.round(endingBalance * 100) / 100,
        transactionCount: period.transactionCount
      });
    }

    // Sort periods by date descending (recent dates first) for frontend display
    periods.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    res.status(200).json({
      success: true,
      data: {
        periods,
        summary: {
          totalIncome: Math.round(
            aggregatedPeriods.reduce((sum, p) => sum + p.income, 0) * 100
          ) / 100,
          totalExpenses: Math.round(
            aggregatedPeriods.reduce((sum, p) => sum + p.expenses, 0) * 100
          ) / 100,
          netFlow: Math.round(
            aggregatedPeriods.reduce((sum, p) => sum + p.netFlow, 0) * 100
          ) / 100,
          totalTransactions: aggregatedPeriods.reduce(
            (sum, p) => sum + p.transactionCount,
            0
          )
        }
      }
    });
  } catch (error) {
    console.error('Get analytics period summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Helper Function: Aggregate transactions by period
 * 
 * Groups transactions into periods (daily, weekly, or monthly) and calculates
 * totals for income, expenses, and net flow for each period.
 * 
 * @param transactions - Array of transaction records
 * @param walletId - The wallet ID (to identify sent vs received)
 * @param interval - Grouping interval: 'daily', 'weekly', or 'monthly'
 * @returns Promise<Array> - Array of period summaries with totals
 * 
 * Example output:
 *   [
 *     { 
 *       date: '2024-12-12',
 *       periodLabel: '2024-12-12',
 *       income: 5000,
 *       expenses: 2000,
 *       netFlow: 3000,
 *       transactionCount: 15
 *     }
 *   ]
 */
const aggregateTransactionsByPeriod = async (
  transactions: any[],
  walletId: string,
  interval: 'daily' | 'weekly' | 'monthly'
): Promise<any[]> => {
  try {
    // Group transactions by period
    const periodMap = new Map<string, any>();

    for (const txn of transactions) {
      const txnDate = new Date(txn.createdAt);
      let periodKey: string;
      let periodLabel: string;

      // Determine period key based on interval
      switch (interval) {
        case 'daily':
          periodKey = txnDate.toISOString().split('T')[0]; // YYYY-MM-DD
          periodLabel = periodKey;
          break;

        case 'weekly':
          // Get the start of the week (Monday)
          const weekStart = new Date(txnDate);
          const day = weekStart.getDay();
          const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1);
          weekStart.setDate(diff);
          periodKey = weekStart.toISOString().split('T')[0];
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekEnd.getDate() + 6);
          periodLabel = `${periodKey} to ${weekEnd.toISOString().split('T')[0]}`;
          break;

        case 'monthly':
          periodKey = txnDate.toISOString().slice(0, 7); // YYYY-MM
          periodLabel = periodKey;
          break;

        default:
          throw new Error('Invalid interval');
      }

      // Initialize period if not exists
      if (!periodMap.has(periodKey)) {
        periodMap.set(periodKey, {
          date: periodKey,
          periodLabel,
          income: 0,
          expenses: 0,
          transactionCount: 0
        });
      }

      const period = periodMap.get(periodKey);

      // Categorize transaction as income or expense
      if (txn.receiverWalletId === walletId) {
        // Money RECEIVED (income)
        period.income += parseFloat(txn.amount.toString());
      } else if (txn.senderWalletId === walletId) {
        // Money SENT (expense)
        period.expenses += parseFloat(txn.amount.toString());
      }

      period.transactionCount += 1;
    }

    // Convert map to array and calculate net flow
    const result = Array.from(periodMap.values()).map(period => ({
      ...period,
      netFlow: period.income - period.expenses
    }));

    // Sort by date ascending (oldest to newest) for balance calculations
    result.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return result;
  } catch (error) {
    console.error('Aggregate transactions by period error:', error);
    throw error;
  }
};

/**
 * Helper Function: Calculate wallet balance at a specific date
 * 
 * This function calculates what a wallet's balance was at a specific point in time
 * by starting with the current balance and reversing all transactions that occurred
 * after the target date.
 * 
 * @param walletId - The wallet ID to calculate balance for
 * @param targetDate - The date to calculate balance for (Date object)
 * @returns Promise<number> - The wallet balance at the target date
 * 
 * Example:
 *   Current balance: 67,000
 *   Transactions after Dec 12: received 5,000, sent 3,000
 *   Balance at Dec 12 = 67,000 - 5,000 + 3,000 = 65,000
 */
const calculateWalletBalanceAtDate = async (
  walletId: string,
  targetDate: Date
): Promise<number> => {
  try {
    // Get current wallet balance
    const wallet = await Wallet.findByPk(walletId);
    if (!wallet) {
      throw new Error('Wallet not found');
    }

    const currentBalance = parseFloat(wallet.balance.toString());

    // Find all transactions AFTER the target date
    const futureTransactions = await TransactionModel.findAll({
      where: {
        [Op.or]: [
          { senderWalletId: walletId },
          { receiverWalletId: walletId }
        ],
        status: 'completed',
        createdAt: { [Op.gt]: targetDate }
      }
    });

    // Calculate the net impact of future transactions
    let futureNetFlow = 0;

    for (const txn of futureTransactions) {
      if (txn.senderWalletId === walletId) {
        // Money sent OUT (decrease balance)
        futureNetFlow -= parseFloat(txn.amount.toString());
      } else if (txn.receiverWalletId === walletId) {
        // Money received IN (increase balance)
        futureNetFlow += parseFloat(txn.amount.toString());
      }
    }

    // Balance at target date = reverse out the future transactions
    const balanceAtTargetDate = currentBalance - futureNetFlow;

    return balanceAtTargetDate;
  } catch (error) {
    console.error('Calculate wallet balance at date error:', error);
    throw error;
  }
};

export default {
  getExpenseSummary,
  getCategoryBreakdown,
  getSpendingTrends,
  getRecentTransactions,
  getCategoryTransactions,
  getSpendingComparison,
  getAnalyticsPeriodSummary,
  aggregateTransactionsByPeriod,
  calculateWalletBalanceAtDate
};
