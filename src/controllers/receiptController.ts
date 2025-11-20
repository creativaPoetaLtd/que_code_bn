import { Response } from "express";
import { AuthenticatedRequest } from "../types/requests";
import Models from "../database/models";
import { PDFGenerator } from "../utils/pdfGenerator";
import * as path from 'path';
import * as fs from 'fs';

// Download transaction receipt
export const downloadReceipt = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const { transactionId } = req.params;
        const userId = req.user.id;
        const models = req.app.get("models") as ReturnType<typeof Models>;

        // Find the transaction
        const transaction = await models.Transaction.findByPk(transactionId);

        if (!transaction) {
            res.status(404).json({
                success: false,
                message: "Transaction not found"
            });
            return;
        }

        // Verify user is either sender or receiver
        const senderWallet = await models.Wallet.findByPk(transaction.senderWalletId);
        const receiverWallet = await models.Wallet.findByPk(transaction.receiverWalletId);

        if (senderWallet?.userId !== userId && receiverWallet?.userId !== userId) {
            res.status(403).json({
                success: false,
                message: "Unauthorized to access this receipt"
            });
            return;
        }

        // Get sender and receiver details
        const senderUser = await models.User.findByPk(senderWallet!.userId);
        const receiverUser = await models.User.findByPk(receiverWallet!.userId);

        // Get chat message to find note
        const chatMessage = await models.ChatMessage.findOne({
            where: { transactionId: transaction.id }
        });

        let note = '';
        if (chatMessage && chatMessage.content) {
            try {
                const messageData = JSON.parse(chatMessage.content);
                note = messageData.note || '';
            } catch {
                note = chatMessage.content;
            }
        }

        // Generate receipt data
        const receiptData = {
            transactionId: transaction.id,
            referenceId: transaction.referenceId,
            senderName: `${senderUser?.firstName} ${senderUser?.lastName}`,
            recipientName: `${receiverUser?.firstName} ${receiverUser?.lastName}`,
            amount: parseFloat(transaction.amount.toString()),
            fee: parseFloat(transaction.fee?.toString() || '0'),
            totalAmount: parseFloat(transaction.totalAmount?.toString() || transaction.amount.toString()),
            currency: transaction.currency,
            date: (transaction as any).createdAt || new Date(),
            status: transaction.status,
            note: note
        };

        // Check if PDF already exists
        const receiptFileName = PDFGenerator.getReceiptFileName(
            transaction.id,
            transaction.referenceId
        );
        const receiptPath = path.join(__dirname, '../../uploads/receipts', receiptFileName);

        let pdfBuffer: Buffer;

        if (fs.existsSync(receiptPath)) {
            // Use existing PDF
            pdfBuffer = fs.readFileSync(receiptPath);
        } else {
            // Generate new PDF
            pdfBuffer = await PDFGenerator.generateTransactionReceipt(receiptData);

            // Save for future use
            const uploadsDir = path.join(__dirname, '../../uploads/receipts');
            if (!fs.existsSync(uploadsDir)) {
                fs.mkdirSync(uploadsDir, { recursive: true });
            }
            fs.writeFileSync(receiptPath, pdfBuffer);
        }

        // Send PDF
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${receiptFileName}"`);
        res.setHeader('Content-Length', pdfBuffer.length);
        res.send(pdfBuffer);

    } catch (error) {
        console.error("Error downloading receipt:", error);
        res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : "Failed to download receipt"
        });
    }
};
