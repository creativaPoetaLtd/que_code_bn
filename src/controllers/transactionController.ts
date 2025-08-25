import { Request, Response } from 'express';
import { insert_function, read_function } from "../utils/db_methods";
import { 
    TransactionCreationAttributes, 
    TransactionModelAttributes, 
    WalletModelAttributes,
    UserModelAttributes 
} from "../types/model";
import { v4 as uuidv4 } from 'uuid';
import { Op, where, col, cast } from 'sequelize';
import { EXPENSE_CATEGORIES, getCategoryById } from '../constants/categories';

// Calculate transaction fee (2% of amount) with proper decimal handling
const calculateFee = (amount: number): number => {
    const fee = parseFloat(amount.toString()) * 0.02;
    return parseFloat(fee.toFixed(2));
};

// Transfer money between users
const transfer_money = async (req: Request, res: Response): Promise<void> => {
    try {
        const { receiverId, amount, description, categoryId } = req.body;
        const senderId = req.body.senderId; // This should come from authenticated user

        // Validate input
        if (!receiverId || !amount || amount <= 0) {
            res.status(400).json({ message: "Invalid transfer data" });
            return;
        }

        // Validate category if provided
        if (categoryId && !getCategoryById(categoryId)) {
            res.status(400).json({ message: "Invalid category" });
            return;
        }

        if (senderId === receiverId) {
            res.status(400).json({ message: "Cannot transfer money to yourself" });
            return;
        }

        // Check if sender exists and is approved
        const sender = await read_function<UserModelAttributes>(
            "User",
            "findOne",
            { where: { id: senderId } }
        );

        if (!sender || !sender.isVerified) {
            res.status(404).json({ message: "Sender not found or not approved" });
            return;
        }

        // Check if receiver exists and is approved
        const receiver = await read_function<UserModelAttributes>(
            "User",
            "findOne",
            { where: { id: receiverId } }
        );

        if (!receiver || !receiver.isVerified) {
            res.status(404).json({ message: "Receiver not found or not approved" });
            return;
        }

        // Get sender's wallet
        const senderWallet = await read_function<WalletModelAttributes>(
            "Wallet",
            "findOne",
            { where: { userId: senderId, isActive: true } }
        );

        if (!senderWallet) {
            res.status(404).json({ message: "Sender wallet not found" });
            return;
        }

        // Get receiver's wallet
        const receiverWallet = await read_function<WalletModelAttributes>(
            "Wallet",
            "findOne",
            { where: { userId: receiverId, isActive: true } }
        );

        if (!receiverWallet) {
            res.status(404).json({ message: "Receiver wallet not found" });
            return;
        }

        // Calculate fee and total amount with proper decimal handling
        const transferAmount = parseFloat(parseFloat(amount.toString()).toFixed(2));
        const fee = parseFloat((transferAmount * 0.02).toFixed(2));
        const totalAmount = parseFloat((transferAmount + fee).toFixed(2));
        const senderCurrentBalance = parseFloat(senderWallet.balance.toString());
        const receiverCurrentBalance = parseFloat(receiverWallet.balance.toString());

        // Check if sender has sufficient balance
        if (senderCurrentBalance < totalAmount) {
            res.status(400).json({ 
                message: "Insufficient balance",
                required: totalAmount,
                available: senderCurrentBalance,
                fee: fee
            });
            return;
        }

        // Create transaction record
        const transactionData: TransactionCreationAttributes = {
            id: uuidv4(),
            senderId,
            receiverId,
            amount: transferAmount,
            fee,
            totalAmount: totalAmount,
            type: 'transfer',
            status: 'pending',
            description: description || `Transfer from ${sender.firstName} ${sender.lastName} to ${receiver.firstName} ${receiver.lastName}`,
            categoryId: categoryId || null,
            metadata: {
                senderName: `${sender.firstName} ${sender.lastName}`,
                receiverName: `${receiver.firstName} ${receiver.lastName}`,
                senderEmail: sender.email,
                receiverEmail: receiver.email
            }
        };

        const transaction = await insert_function<TransactionModelAttributes>(
            "Transaction",
            "create",
            transactionData
        );

        try {
            // Update sender wallet (deduct total amount) with proper decimal handling
            const newSenderBalance = parseFloat((senderCurrentBalance - totalAmount).toFixed(2));
            await insert_function<WalletModelAttributes>(
                "Wallet",
                "update",
                { balance: newSenderBalance },
                { where: { id: senderWallet.id } }
            );

            // Update receiver wallet (add amount only, fee goes to system) with proper decimal handling
            const newReceiverBalance = parseFloat((receiverCurrentBalance + transferAmount).toFixed(2));
            await insert_function<WalletModelAttributes>(
                "Wallet",
                "update",
                { balance: newReceiverBalance },
                { where: { id: receiverWallet.id } }
            );

            // Update transaction status to completed
            await insert_function<TransactionModelAttributes>(
                "Transaction",
                "update",
                { 
                    status: 'completed',
                    processedAt: new Date()
                },
                { where: { id: transaction.id } }
            );

            console.log(`💸 Transfer Debug:
                - Transfer amount: ${transferAmount}
                - Fee: ${fee}
                - Total deducted: ${totalAmount}
                - Sender old balance: ${senderCurrentBalance}
                - Sender new balance: ${newSenderBalance}
                - Receiver old balance: ${receiverCurrentBalance}
                - Receiver new balance: ${newReceiverBalance}`);

            res.status(200).json({
                message: "Transfer completed successfully",
                transaction: {
                    id: transaction.id,
                    transactionId: transaction.transactionId,
                    amount: transaction.amount,
                    fee: transaction.fee,
                    totalAmount: transaction.totalAmount,
                    status: 'completed',
                    description: transaction.description,
                    processedAt: new Date()
                },
                balances: {
                    senderBalance: newSenderBalance,
                    receiverBalance: newReceiverBalance
                }
            });

        } catch (walletError) {
            // If wallet update fails, mark transaction as failed
            await insert_function<TransactionModelAttributes>(
                "Transaction",
                "update",
                { status: 'failed' },
                { where: { id: transaction.id } }
            );

            throw walletError;
        }

    } catch (error: any) {
        console.error("Transfer error:", error.message);
        res.status(500).json({ message: "An error occurred during the transfer" });
    }
};

// Get user's transaction history
const get_transaction_history = async (req: Request, res: Response): Promise<void> => {
    try {
        const { userId } = req.params;
        const { page = 1, limit = 10, type, status, search, startDate, endDate } = req.query;

        // Build where condition
        const whereCondition: any = {
            [Op.or]: [
                { senderId: userId },
                { receiverId: userId }
            ]
        };

        if (type) {
            whereCondition.type = type;
        }

        if (status) {
            whereCondition.status = status;
        }
        // Search by description or type
        if (search) {
            whereCondition[Op.or].push(
                { description: { [Op.iLike]: `%${search}%` } },
                // Cast enum 'type' to text for case-insensitive search
                where(cast(col('type'), 'text'), { [Op.iLike]: `%${search}%` })
            );
        }
        // Date range filter
        if (startDate && endDate) {
            whereCondition.createdAt = { [Op.between]: [startDate, endDate] };
        } else if (startDate) {
            whereCondition.createdAt = { [Op.gte]: startDate };
        } else if (endDate) {
            whereCondition.createdAt = { [Op.lte]: endDate };
        }

        const offset = (Number(page) - 1) * Number(limit);

        const transactions = await read_function<TransactionModelAttributes[]>(
            "Transaction",
            "findAll",
            {
                where: whereCondition,
                order: [['createdAt', 'DESC']],
                limit: Number(limit),
                offset: offset
            }
        );

        res.status(200).json({
            transactions,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total: transactions.length
            }
        });

    } catch (error: any) {
        console.error("Get transaction history error:", error.message);
        res.status(500).json({ message: "An error occurred while fetching transaction history" });
    }
};

// Get wallet balance
const get_wallet_balance = async (req: Request, res: Response): Promise<void> => {
    try {
        const { userId } = req.params;

        const wallet = await read_function<WalletModelAttributes>(
            "Wallet",
            "findOne",
            { where: { userId, isActive: true } }
        );

        if (!wallet) {
            res.status(404).json({ message: "Wallet not found" });
            return;
        }

        res.status(200).json({
            userId: wallet.userId,
            balance: wallet.balance,
            currency: wallet.currency,
            isActive: wallet.isActive
        });

    } catch (error: any) {
        console.error("Get wallet balance error:", error.message);
        res.status(500).json({ message: "An error occurred while fetching wallet balance" });
    }
};

// Create wallet for user (admin function)
const create_wallet = async (req: Request, res: Response): Promise<void> => {
    try {
        const { userId, initialBalance = 0 } = req.body;

        // Check if user exists
        const user = await read_function<UserModelAttributes>(
            "User",
            "findOne",
            { where: { id: userId } }
        );

        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }

        // Check if wallet already exists
        const existingWallet = await read_function<WalletModelAttributes>(
            "Wallet",
            "findOne",
            { where: { userId } }
        );

        if (existingWallet) {
            res.status(400).json({ message: "Wallet already exists for this user" });
            return;
        }

        const walletData = {
            id: uuidv4(),
            userId,
            balance: Number(initialBalance),
            currency: 'RWF',
            isActive: true
        };

        const wallet = await insert_function<WalletModelAttributes>(
            "Wallet",
            "create",
            walletData
        );

        res.status(201).json({
            message: "Wallet created successfully",
            wallet: {
                id: wallet.id,
                userId: wallet.userId,
                balance: wallet.balance,
                currency: wallet.currency,
                isActive: wallet.isActive
            }
        });

    } catch (error: any) {
        console.error("Create wallet error:", error.message);
        res.status(500).json({ message: "An error occurred while creating wallet" });
    }
};

// Add money to wallet (admin function or deposit)
const add_money_to_wallet = async (req: Request, res: Response): Promise<void> => {
    try {
        const { userId, amount, description } = req.body;

        if (!amount || amount <= 0) {
            res.status(400).json({ message: "Invalid amount" });
            return;
        }

        // Get user's wallet
        const wallet = await read_function<WalletModelAttributes>(
            "Wallet",
            "findOne",
            { where: { userId, isActive: true } }
        );

        if (!wallet) {
            res.status(404).json({ message: "Wallet not found" });
            return;
        }

        // Properly handle decimal precision - convert to string first, then parse as float with 2 decimal places
        const depositAmount = parseFloat(parseFloat(amount.toString()).toFixed(2));
        const currentBalance = parseFloat(wallet.balance.toString());

        // Create deposit transaction
        const transactionData: TransactionCreationAttributes = {
            id: uuidv4(),
            senderId: userId, // System deposit
            receiverId: userId,
            amount: depositAmount,
            fee: 0, // No fee for deposits
            totalAmount: depositAmount, // For deposits, total amount equals amount
            type: 'deposit',
            status: 'completed',
            description: description || 'Wallet deposit',
            processedAt: new Date()
        };

        const transaction = await insert_function<TransactionModelAttributes>(
            "Transaction",
            "create",
            transactionData
        );

        // Update wallet balance with proper decimal handling
        const newBalance = parseFloat((currentBalance + depositAmount).toFixed(2));
        await insert_function<WalletModelAttributes>(
            "Wallet",
            "update",
            { balance: newBalance },
            { where: { id: wallet.id } }
        );

        console.log(`💰 Deposit Debug:
            - User ID: ${userId}
            - Amount requested: ${amount}
            - Parsed amount: ${depositAmount}
            - Current balance: ${currentBalance}
            - New balance: ${newBalance}
            - Transaction ID: ${transaction.id}`);

        res.status(200).json({
            message: "Money added to wallet successfully",
            transaction: {
                id: transaction.id,
                transactionId: transaction.transactionId,
                amount: transaction.amount,
                type: transaction.type,
                status: transaction.status
            },
            newBalance,
            debug: {
                amountRequested: amount,
                amountParsed: depositAmount,
                previousBalance: currentBalance,
                newBalance: newBalance
            }
        });

    } catch (error: any) {
        console.error("Add money to wallet error:", error.message);
        res.status(500).json({ message: "An error occurred while adding money to wallet" });
    }
};

// Get transaction by ID
const get_transaction_by_id = async (req: Request, res: Response): Promise<void> => {
    try {
        const { transactionId } = req.params;

        const transaction = await read_function<TransactionModelAttributes>(
            "Transaction",
            "findOne",
            { where: { id: transactionId } }
        );

        if (!transaction) {
            res.status(404).json({ message: "Transaction not found" });
            return;
        }

        res.status(200).json(transaction);

    } catch (error: any) {
        console.error("Get transaction by ID error:", error.message);
        res.status(500).json({ message: "An error occurred while fetching transaction" });
    }
};

// Get all available expense categories
const getCategories = async (req: Request, res: Response): Promise<void> => {
    try {
        res.status(200).json({
            success: true,
            data: EXPENSE_CATEGORIES
        });
    } catch (error: any) {
        console.error("Get categories error:", error.message);
        res.status(500).json({ message: "An error occurred while fetching categories" });
    }
};

export default {
    transfer_money,
    get_transaction_history,
    get_wallet_balance,
    create_wallet,
    add_money_to_wallet,
    get_transaction_by_id,
    getCategories
};
