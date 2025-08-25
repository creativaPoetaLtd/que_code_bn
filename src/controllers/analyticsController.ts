import { Request, Response } from 'express';
import { Op, QueryTypes } from 'sequelize';
import sequelize from '../database/config/database';
import Models from '../database/models';
import { EXPENSE_CATEGORIES, getCategoryById, getCategoryName } from '../constants/categories';

// Initialize models
const models = Models(sequelize);
const { Transaction } = models;

// Get expense summary statistics
const getExpenseSummary = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req.user as any)?.id;
    const { startDate, endDate } = req.query;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
      return;
    }

    // Set default date range (last 30 days)
    const end = endDate ? new Date(endDate as string) : new Date();
    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Get transactions where user is the sender (outgoing money)
    const transactions = await Transaction.findAll({
      where: {
        senderId: userId,
        status: 'completed',
        createdAt: {
          [Op.between]: [start, end]
        }
      }
    });

    // Calculate summary statistics
    const totalSpent = transactions.reduce((sum, transaction) => {
      return sum + parseFloat(transaction.totalAmount.toString());
    }, 0);

    const totalTransactions = transactions.length;
    const averageTransaction = totalTransactions > 0 ? totalSpent / totalTransactions : 0;

    res.status(200).json({
      success: true,
      data: {
        totalSpent: parseFloat(totalSpent.toFixed(2)),
        totalTransactions,
        averageTransaction: parseFloat(averageTransaction.toFixed(2)),
        period: {
          startDate: start,
          endDate: end
        }
      }
    });
  } catch (error) {
    console.error('Error getting expense summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get expense summary',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Get expense breakdown by categories
const getCategoryBreakdown = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req.user as any)?.id;
    const { startDate, endDate } = req.query;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
      return;
    }

    // Set default date range (last 30 days)
    const end = endDate ? new Date(endDate as string) : new Date();
    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Get transactions with category breakdown
    const transactions = await Transaction.findAll({
      where: {
        senderId: userId,
        status: 'completed',
        createdAt: {
          [Op.between]: [start, end]
        }
      }
    });

    // Group by category
    const categoryBreakdown = transactions.reduce((acc: any, transaction: any) => {
      const categoryId = transaction.categoryId || 'uncategorized';
      const category = getCategoryById(categoryId);
      const categoryName = category ? category.name : 'Uncategorized';
      const categoryIcon = category ? category.icon : '📦';
      const categoryColor = category ? category.color : '#747D8C';

      if (!acc[categoryId]) {
        acc[categoryId] = {
          id: categoryId,
          name: categoryName,
          icon: categoryIcon,
          color: categoryColor,
          totalAmount: 0,
          transactionCount: 0
        };
      }

      acc[categoryId].totalAmount += parseFloat(transaction.totalAmount.toString());
      acc[categoryId].transactionCount += 1;

      return acc;
    }, {});

    // Convert to array and sort by amount
    const breakdown: any[] = Object.values(categoryBreakdown).sort((a: any, b: any) => b.totalAmount - a.totalAmount);

    // Calculate total for percentages
    const totalSpent: number = breakdown.reduce((sum: number, category: any) => sum + category.totalAmount, 0);

    // Add percentages
    const breakdownWithPercentages = breakdown.map((category: any) => ({
      ...category,
      totalAmount: parseFloat(category.totalAmount.toFixed(2)),
      percentage: totalSpent > 0 ? parseFloat(((category.totalAmount / totalSpent) * 100).toFixed(1)) : 0
    }));

    res.status(200).json({
      success: true,
      data: {
        breakdown: breakdownWithPercentages,
        totalSpent: parseFloat(totalSpent.toFixed(2)),
        period: {
          startDate: start,
          endDate: end
        }
      }
    });
  } catch (error) {
    console.error('Error getting category breakdown:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get category breakdown',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Get spending trends over time
const getSpendingTrends = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req.user as any)?.id;
    const { period = 'daily', limit = 30 } = req.query;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
      return;
    }

    // Determine grouping and date range
    let groupBy: string;
    let startDate: Date;

    switch (period) {
      case 'daily':
        groupBy = "DATE_TRUNC('day', \"createdAt\")";
        startDate = new Date(Date.now() - parseInt(limit as string) * 24 * 60 * 60 * 1000);
        break;
      case 'weekly':
        groupBy = "DATE_TRUNC('week', \"createdAt\")";
        startDate = new Date(Date.now() - parseInt(limit as string) * 7 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
        groupBy = "DATE_TRUNC('month', \"createdAt\")";
        startDate = new Date();
        startDate.setMonth(startDate.getMonth() - parseInt(limit as string));
        break;
      default:
        groupBy = "DATE_TRUNC('day', \"createdAt\")";
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    }

    const trends = await sequelize.query(`
      SELECT 
        ${groupBy} as period,
        SUM("totalAmount") as total_spent,
        COUNT(*) as transaction_count,
        AVG("totalAmount") as average_amount
      FROM transactions 
      WHERE "senderId" = :userId 
        AND status = 'completed'
        AND "createdAt" >= :startDate
      GROUP BY ${groupBy}
      ORDER BY period ASC
    `, {
      replacements: { userId, startDate },
      type: QueryTypes.SELECT
    });

    res.status(200).json({
      success: true,
      data: {
        period,
        trends: trends || [],
        summary: {
          totalPeriods: (trends || []).length,
          periodType: period
        }
      }
    });
  } catch (error) {
    console.error('Error getting spending trends:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get spending trends',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Get recent transactions with categories
const getRecentTransactions = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req.user as any)?.id;
    const { limit = 10, categoryId } = req.query;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
      return;
    }

    const whereCondition: any = {
      senderId: userId,
      status: 'completed'
    };

    if (categoryId) {
      whereCondition.categoryId = categoryId;
    }

    const transactions = await Transaction.findAll({
      where: whereCondition,
      limit: parseInt(limit as string),
      order: [['createdAt', 'DESC']]
    });

    // Add category information
    const transactionsWithCategories = transactions.map((transaction: any) => {
      const category = getCategoryById(transaction.categoryId);
      return {
        ...transaction.toJSON(),
        category: category ? {
          id: category.id,
          name: category.name,
          icon: category.icon,
          color: category.color
        } : {
          id: 'uncategorized',
          name: 'Uncategorized',
          icon: '📦',
          color: '#747D8C'
        }
      };
    });

    res.status(200).json({
      success: true,
      data: transactionsWithCategories
    });
  } catch (error) {
    console.error('Error getting recent transactions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get recent transactions',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export default {
  getExpenseSummary,
  getCategoryBreakdown,
  getSpendingTrends,
  getRecentTransactions
};
