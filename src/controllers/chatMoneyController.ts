import { Response } from "express";
import { AuthenticatedRequest } from "../types/requests";
import Models from "../database/models";
import * as bcrypt from 'bcrypt';
import { Op } from "sequelize";
import { sequelizeConnection } from "../database/config/db.config";
import ChatService from "../services/chatService";
import { PDFGenerator } from "../utils/pdfGenerator";
import { getAvailableBalance } from "../utils/walletBalance";
import * as fs from 'fs';
import * as path from 'path';

// Send money through chat
export const sendMoneyInChat = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    const dbTransaction = await sequelizeConnection.transaction();

    try {
        const userId = req.user.id;
        const { chatId } = req.params;
        const { amount, pin, note } = req.body;

        console.log('Send money request:', { userId, chatId, amount, pin: pin ? '****' : undefined, note, body: req.body });

        // Validation
        if (!amount || amount <= 0) {
            res.status(400).json({
                success: false,
                message: "Amount must be greater than 0"
            });
            return;
        }

        if (!pin) {
            res.status(400).json({
                success: false,
                message: "PIN is required for transactions"
            });
            return;
        }

        // Validate PIN format
        if (!/^\d{4}$/.test(pin)) {
            res.status(400).json({
                success: false,
                message: "PIN must be exactly 4 digits"
            });
            return;
        }

        const models = req.app.get("models") as ReturnType<typeof Models>;
        const chatService = ChatService.getInstance();

        // Verify user is participant in the chat
        const participant = await models.ChatParticipant.findOne({
            where: { chatId, userId },
            transaction: dbTransaction
        });

        if (!participant) {
            await dbTransaction.rollback();
            res.status(403).json({
                success: false,
                message: "You are not authorized to send money in this chat"
            });
            return;
        }

        // Get chat details to find recipient or group
        const chat = await models.Chat.findByPk(chatId, {
            include: [
                {
                    model: models.ChatParticipant,
                    as: 'participants',
                    include: [{
                        model: models.User,
                        as: 'user',
                        attributes: ['id', 'firstName', 'lastName', 'email']
                    }]
                },
                {
                    model: models.Group,
                    as: 'group',
                    include: [{
                        model: models.Wallet,
                        as: 'wallet',
                        attributes: ['id', 'balance', 'isActive']
                    }]
                }
            ],
            transaction: dbTransaction
        });

        if (!chat) {
            await dbTransaction.rollback();
            res.status(404).json({
                success: false,
                message: "Chat not found"
            });
            return;
        }

        let recipientId: string | undefined;
        let recipientUser: any;
        let recipientWallet: any;
        let isGroupFundraising = false;
        let groupDetails: any;

        // Handle group chats with fundraising
        if (chat.isGroup) {
            const group = (chat as any).group;
            
            if (!group) {
                await dbTransaction.rollback();
                res.status(404).json({
                    success: false,
                    message: "Group details not found for this chat"
                });
                return;
            }

            // Check if group has fundraising enabled
            if (!group.hasFundraising) {
                await dbTransaction.rollback();
                res.status(400).json({
                    success: false,
                    message: "This group does not accept donations. Money can only be sent to fundraising groups."
                });
                return;
            }

            // Check if group has a wallet
            if (!group.wallet) {
                await dbTransaction.rollback();
                res.status(404).json({
                    success: false,
                    message: "Group wallet not found. Please contact support."
                });
                return;
            }

            if (!group.wallet.isActive) {
                await dbTransaction.rollback();
                res.status(400).json({
                    success: false,
                    message: "Group wallet is inactive"
                });
                return;
            }

            isGroupFundraising = true;
            groupDetails = group;
            recipientWallet = group.wallet;
        } else {
            // For direct messages, find recipient (the other participant)
            const participants = (chat as any).participants as any[];
            const recipientParticipant = participants.find((p: any) => p.userId !== userId);

            if (!recipientParticipant) {
                await dbTransaction.rollback();
                res.status(404).json({
                    success: false,
                    message: "Recipient not found in chat"
                });
                return;
            }

            recipientId = recipientParticipant.userId;
            recipientUser = recipientParticipant.get('user') as any;
        }

        // Get authenticated user for PIN verification
        const authenticatedUser = await models.User.findByPk(userId, {
            transaction: dbTransaction
        });

        if (!authenticatedUser) {
            await dbTransaction.rollback();
            res.status(404).json({
                success: false,
                message: "User not found"
            });
            return;
        }

        // Check if user has set up PIN
        if (!authenticatedUser.hasPinSet || !authenticatedUser.transactionPin) {
            await dbTransaction.rollback();
            res.status(403).json({
                success: false,
                message: "PIN not set up. Please set up your transaction PIN before sending money.",
                requiresPinSetup: true
            });
            return;
        }

        // Check if user is locked out
        if (authenticatedUser.pinLockedUntil && authenticatedUser.pinLockedUntil > new Date()) {
            const remainingTime = Math.ceil((authenticatedUser.pinLockedUntil.getTime() - Date.now()) / 60000);
            await dbTransaction.rollback();
            res.status(429).json({
                success: false,
                message: `PIN is temporarily locked. Try again in ${remainingTime} minutes.`,
                lockedUntil: authenticatedUser.pinLockedUntil,
                remainingMinutes: remainingTime
            });
            return;
        }

        // Verify PIN
        const isValidPin = await bcrypt.compare(pin, authenticatedUser.transactionPin);

        if (!isValidPin) {
            const newAttempts = (authenticatedUser.pinAttempts || 0) + 1;
            const maxAttempts = 5;
            const lockoutMinutes = 15;

            if (newAttempts >= maxAttempts) {
                const lockedUntil = new Date(Date.now() + lockoutMinutes * 60000);
                await authenticatedUser.update({
                    pinAttempts: newAttempts,
                    pinLockedUntil: lockedUntil
                }, { transaction: dbTransaction });

                await dbTransaction.rollback();
                res.status(429).json({
                    success: false,
                    message: `PIN verification failed. Account locked for ${lockoutMinutes} minutes due to too many failed attempts.`,
                    attemptsRemaining: 0,
                    lockedUntil: lockedUntil,
                    remainingMinutes: lockoutMinutes
                });
                return;
            } else {
                await authenticatedUser.update({
                    pinAttempts: newAttempts
                }, { transaction: dbTransaction });

                await dbTransaction.rollback();
                const attemptsRemaining = maxAttempts - newAttempts;
                res.status(400).json({
                    success: false,
                    message: `Invalid PIN. ${attemptsRemaining} attempts remaining.`,
                    attemptsRemaining: attemptsRemaining
                });
                return;
            }
        }

        // Reset PIN attempts on successful verification
        await authenticatedUser.update({
            pinAttempts: 0,
            pinLockedUntil: null
        }, { transaction: dbTransaction });

        // Check for duplicate transactions in the last 30 seconds
        const thirtySecondsAgo = new Date(Date.now() - 30000);

        // Get sender wallet
        const senderWallet = await models.Wallet.findOne({
            where: { userId, isActive: true },
            lock: dbTransaction.LOCK.UPDATE,
            transaction: dbTransaction
        });

        if (!senderWallet) {
            await dbTransaction.rollback();
            res.status(404).json({
                success: false,
                message: "Your wallet not found or inactive"
            });
            return;
        }

        // Get or verify receiver wallet based on chat type
        if (!isGroupFundraising) {
            recipientWallet = await models.Wallet.findOne({
                where: { userId: recipientId, isActive: true },
                lock: dbTransaction.LOCK.UPDATE,
                transaction: dbTransaction
            });

            if (!recipientWallet) {
                await dbTransaction.rollback();
                res.status(404).json({
                    success: false,
                    message: "Recipient wallet not found or inactive"
                });
                return;
            }
        } else {
            // For group wallets, lock for update
            recipientWallet = await models.Wallet.findByPk(recipientWallet.id, {
                lock: dbTransaction.LOCK.UPDATE,
                transaction: dbTransaction
            });
        }

        // Check for duplicate recent transaction
        const recentTransaction = await models.Transaction.findOne({
            where: {
                senderWalletId: senderWallet.id,
                receiverWalletId: recipientWallet.id,
                amount: parseFloat(amount),
                createdAt: {
                    [Op.gte]: thirtySecondsAgo
                },
                status: 'completed'
            },
            transaction: dbTransaction
        });

        if (recentTransaction) {
            await dbTransaction.rollback();
            res.status(400).json({
                success: false,
                message: 'Duplicate transaction detected. Please wait before making another similar transfer.'
            });
            return;
        }

        // Check sufficient balance
        const transferAmount = parseFloat(amount);
        const fee = 0; // No fee for now
        const totalAmount = transferAmount + fee;

        console.log('Transfer details:', { transferAmount, fee, totalAmount, amount, isGroupFundraising });

        if (getAvailableBalance(senderWallet) < totalAmount) {
            await dbTransaction.rollback();
            res.status(400).json({
                success: false,
                message: `Insufficient balance. You have ${senderWallet.balance} RWF, but need ${totalAmount} RWF`
            });
            return;
        }

        // Determine transaction type and description
        const transactionType = isGroupFundraising ? 'donation' : 'transfer';
        const description = note || (isGroupFundraising 
            ? `Donation to ${groupDetails.name}` 
            : `Money sent via chat`);

        // Create transaction record
        const transactionRecord = await models.Transaction.create({
            senderWalletId: senderWallet.id,
            receiverWalletId: recipientWallet.id,
            amount: parseFloat(amount),
            fee: 0,
            totalAmount: parseFloat(amount) + 0,
            currency: 'RWF',
            referenceId: `CHAT-${chatId.substring(0, 8)}-${Date.now()}`,
            type: transactionType,
            description: description,
            status: 'completed'
        } as any, { transaction: dbTransaction });

        // Update wallet balances
        await senderWallet.update({
            balance: parseFloat(senderWallet.balance.toString()) - totalAmount
        }, { transaction: dbTransaction });

        await recipientWallet.update({
            balance: parseFloat(recipientWallet.balance.toString()) + transferAmount
        }, { transaction: dbTransaction });

        // If it's a group donation, update the group's fundraising progress
        if (isGroupFundraising && groupDetails) {
            const newBalance = parseFloat(recipientWallet.balance.toString()) + transferAmount;
            
            // Check if fundraising target has been reached
            if (groupDetails.fundraisingTarget && newBalance >= parseFloat(groupDetails.fundraisingTarget.toString())) {
                // Optionally update group expiration if expirationType is 'target_reached'
                if (groupDetails.expirationType === 'target_reached') {
                    await models.Group.update(
                        { expirationDate: new Date() },
                        { 
                            where: { id: groupDetails.id },
                            transaction: dbTransaction 
                        }
                    );
                }
            }
        }

        console.log('Wallets updated successfully');

        // Generate PDF receipt
        let receiptFileName = '';
        let receiptUrl = '';

        try {
            console.log('Starting PDF receipt generation...');

            const recipientName = isGroupFundraising 
                ? groupDetails.name 
                : `${recipientUser.firstName} ${recipientUser.lastName}`;

            const newBalance = parseFloat(recipientWallet.balance.toString());
            const fundraisingProgress = isGroupFundraising && groupDetails.fundraisingTarget
                ? Math.min((newBalance / parseFloat(groupDetails.fundraisingTarget.toString())) * 100, 100)
                : undefined;

            const receiptData = {
                transactionId: transactionRecord.id,
                referenceId: transactionRecord.referenceId,
                senderName: `${authenticatedUser.firstName} ${authenticatedUser.lastName}`,
                recipientName: recipientName,
                amount: transferAmount,
                fee: 0,
                totalAmount: parseFloat(amount) + 0,
                currency: 'RWF',
                date: new Date(),
                status: 'completed',
                note: note,
                isGroupDonation: isGroupFundraising,
                groupName: isGroupFundraising ? groupDetails.name : undefined,
                fundraisingTarget: isGroupFundraising && groupDetails.fundraisingTarget 
                    ? parseFloat(groupDetails.fundraisingTarget.toString()) 
                    : undefined,
                currentProgress: isGroupFundraising ? newBalance : undefined
            };

            console.log('Receipt data prepared:', { ...receiptData, transactionId: receiptData.transactionId.substring(0, 8) });

            const pdfBuffer = await PDFGenerator.generateTransactionReceipt(receiptData);
            console.log('PDF buffer generated, size:', pdfBuffer.length);

            receiptFileName = PDFGenerator.getReceiptFileName(
                transactionRecord.id,
                transactionRecord.referenceId
            );
            console.log('Receipt filename:', receiptFileName);

            // Save PDF to uploads directory
            const uploadsDir = path.join(__dirname, '../../uploads/receipts');
            console.log('Uploads directory path:', uploadsDir);

            if (!fs.existsSync(uploadsDir)) {
                console.log('Creating uploads directory...');
                fs.mkdirSync(uploadsDir, { recursive: true });
            }

            const receiptPath = path.join(uploadsDir, receiptFileName);
            console.log('Saving PDF to:', receiptPath);

            fs.writeFileSync(receiptPath, pdfBuffer);

            receiptUrl = `/uploads/receipts/${receiptFileName}`;
            console.log('✅ PDF receipt generated successfully:', receiptFileName);
        } catch (pdfError) {
            console.error('❌ Error generating PDF receipt:', pdfError);
            console.error('PDF Error stack:', (pdfError as Error).stack);
            // Continue without PDF - don't fail the transaction
        }

        console.log('Preparing message content...');

        // Create well-structured message content
        const recipientName = isGroupFundraising 
            ? groupDetails.name 
            : `${recipientUser.firstName} ${recipientUser.lastName}`;

        const messageContent = JSON.stringify({
            type: isGroupFundraising ? 'group_donation' : 'money_transfer',
            amount: transferAmount,
            currency: 'RWF',
            senderName: `${authenticatedUser.firstName} ${authenticatedUser.lastName}`,
            recipientName: recipientName,
            groupId: isGroupFundraising ? groupDetails.id : undefined,
            groupName: isGroupFundraising ? groupDetails.name : undefined,
            note: note || '',
            transactionId: transactionRecord.id,
            referenceId: transactionRecord.referenceId,
            timestamp: new Date().toISOString(),
            receiptUrl: receiptUrl || '',
            receiptFileName: receiptFileName || ''
        });

        console.log('✅ Creating chat message with structured content (length:', messageContent.length, ')');
        console.log('Message content preview:', messageContent.substring(0, 200));

        const message = await models.ChatMessage.create({
            chatId,
            senderId: userId,
            content: messageContent,
            messageType: 'money',
            transactionId: transactionRecord.id,
            isEncrypted: false,
            encryptionIv: '',
            status: 'sent'
        }, { transaction: dbTransaction });

        // Commit the database transaction
        await dbTransaction.commit();

        // Get message with sender info for response
        const messageWithSender = await models.ChatMessage.findByPk(message.id, {
            include: [{
                model: models.User,
                as: 'sender',
                attributes: ['id', 'firstName', 'lastName'],
                include: [{
                    model: models.Profile,
                    as: 'profile',
                    attributes: ['profileImage']
                }]
            }]
        });

        // Broadcast via Socket.IO
        const io = req.app.get("io");
        if (io) {
            const participants = await models.ChatParticipant.findAll({
                where: { chatId },
                attributes: ['userId']
            });

            const broadcastMessage = messageWithSender!.toJSON();

            console.log('Broadcasting message:', {
                id: broadcastMessage.id,
                messageType: broadcastMessage.messageType,
                contentLength: broadcastMessage.content?.length,
                contentPreview: broadcastMessage.content?.substring(0, 100),
                isGroupDonation: isGroupFundraising
            });

            for (const p of participants) {
                io.to(`user_${p.userId}`).emit('new_message', broadcastMessage);

                // Send notification to recipient (for DMs) or all group members (for groups)
                if (isGroupFundraising || p.userId === recipientId) {
                    const notificationEvent = isGroupFundraising ? 'group_donation_received' : 'money_received';
                    io.to(`user_${p.userId}`).emit(notificationEvent, {
                        amount: transferAmount,
                        currency: 'RWF',
                        from: `${authenticatedUser.firstName} ${authenticatedUser.lastName}`,
                        groupId: isGroupFundraising ? groupDetails.id : undefined,
                        groupName: isGroupFundraising ? groupDetails.name : undefined,
                        transactionId: transactionRecord.id,
                        referenceId: transactionRecord.referenceId,
                        receiptUrl: receiptUrl || '',
                        chatId
                    });
                }
            }

            // Emit fundraising progress update for group donations
            if (isGroupFundraising) {
                const newBalance = parseFloat(recipientWallet.balance.toString());
                const progress = groupDetails.fundraisingTarget 
                    ? Math.min((newBalance / parseFloat(groupDetails.fundraisingTarget.toString())) * 100, 100)
                    : 0;

                io.to(`group:${groupDetails.id}`).emit('fundraising_progress_update', {
                    groupId: groupDetails.id,
                    groupName: groupDetails.name,
                    currentAmount: newBalance,
                    targetAmount: groupDetails.fundraisingTarget ? parseFloat(groupDetails.fundraisingTarget.toString()) : 0,
                    progress: progress,
                    donorName: `${authenticatedUser.firstName} ${authenticatedUser.lastName}`,
                    donationAmount: transferAmount
                });
            }
        }

        const recipientDisplayName = isGroupFundraising 
            ? groupDetails.name 
            : `${recipientUser.firstName} ${recipientUser.lastName}`;

        const successMessage = isGroupFundraising
            ? `Successfully donated RWF ${transferAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} to ${recipientDisplayName}`
            : `Successfully sent RWF ${transferAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} to ${recipientDisplayName}`;

        res.status(201).json({
            success: true,
            message: successMessage,
            data: {
                transaction: {
                    id: transactionRecord.id,
                    referenceId: transactionRecord.referenceId,
                    amount: transferAmount,
                    currency: 'RWF',
                    fee: 0,
                    totalAmount: parseFloat(amount) + 0,
                    type: transactionType,
                    recipientName: recipientDisplayName,
                    isGroupDonation: isGroupFundraising,
                    groupId: isGroupFundraising ? groupDetails.id : undefined,
                    status: 'completed',
                    timestamp: new Date().toISOString()
                },
                receipt: {
                    url: `/uploads/receipts/${receiptFileName}`,
                    fileName: receiptFileName,
                    downloadUrl: `/api/transactions/receipt/${transactionRecord.id}`
                },
                message: messageWithSender,
                newBalance: parseFloat(senderWallet.balance.toString()) - totalAmount,
                ...(isGroupFundraising && groupDetails.fundraisingTarget && {
                    fundraisingProgress: {
                        currentAmount: parseFloat(recipientWallet.balance.toString()),
                        targetAmount: parseFloat(groupDetails.fundraisingTarget.toString()),
                        progress: Math.min(
                            (parseFloat(recipientWallet.balance.toString()) / parseFloat(groupDetails.fundraisingTarget.toString())) * 100,
                            100
                        )
                    }
                })
            }
        });

    } catch (error) {
        await dbTransaction.rollback();
        console.error("Error sending money in chat:", error);
        res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : "Failed to send money"
        });
    }
};
