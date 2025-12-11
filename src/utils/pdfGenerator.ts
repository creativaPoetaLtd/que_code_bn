import PDFDocument from 'pdfkit';
import { PassThrough } from 'stream';

interface TransactionReceiptData {
    transactionId: string;
    referenceId: string;
    senderName: string;
    recipientName: string;
    amount: number;
    fee: number;
    totalAmount: number;
    currency: string;
    date: Date;
    status: string;
    note?: string;
    isGroupDonation?: boolean;
    groupName?: string;
    fundraisingTarget?: number;
    currentProgress?: number;
}

export class PDFGenerator {
    static async generateTransactionReceipt(data: TransactionReceiptData): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            try {
                const doc = new PDFDocument({
                    size: 'A4',
                    margin: 50,
                    bufferPages: true
                });
                const buffers: Buffer[] = [];

                // Collect PDF data
                doc.on('data', buffers.push.bind(buffers));
                doc.on('end', () => {
                    const pdfBuffer = Buffer.concat(buffers);
                    resolve(pdfBuffer);
                });
                doc.on('error', reject);

                // Header
                const headerColor = data.isGroupDonation ? '#2563eb' : '#10b981';
                const headerTitle = data.isGroupDonation ? 'DONATION RECEIPT' : 'TRANSACTION RECEIPT';
                
                doc.fontSize(24)
                    .font('Helvetica-Bold')
                    .fillColor(headerColor)
                    .text(headerTitle, { align: 'center' });

                doc.moveDown(0.5);
                doc.fontSize(10)
                    .fillColor('#666')
                    .text(data.isGroupDonation ? 'Official Donation Confirmation' : 'Official Payment Confirmation', { align: 'center' });

                // Group fundraising badge (if applicable)
                if (data.isGroupDonation && data.groupName) {
                    doc.moveDown(0.3);
                    doc.fontSize(11)
                        .font('Helvetica-Bold')
                        .fillColor('#2563eb')
                        .text(`Group Fundraiser: ${data.groupName}`, { align: 'center' });
                }

                // Line separator
                doc.moveDown(1);
                doc.strokeColor('#e5e7eb')
                    .lineWidth(1)
                    .moveTo(50, doc.y)
                    .lineTo(545, doc.y)
                    .stroke();

                doc.moveDown(1.5);

                // Transaction Status
                const statusColor = data.status === 'completed' ? '#10b981' : '#ef4444';
                doc.fontSize(14)
                    .font('Helvetica-Bold')
                    .fillColor(statusColor)
                    .text(`Status: ${data.status.toUpperCase()}`, { align: 'center' });

                doc.moveDown(2);

                // Transaction Details Section
                doc.fontSize(12)
                    .font('Helvetica-Bold')
                    .fillColor('#1f2937')
                    .text('TRANSACTION DETAILS', 50);

                doc.moveDown(0.5);
                doc.strokeColor('#e5e7eb')
                    .lineWidth(0.5)
                    .moveTo(50, doc.y)
                    .lineTo(545, doc.y)
                    .stroke();

                doc.moveDown(1);

                // Transaction ID and Reference
                const leftColumn = 50;
                const rightColumn = 300;
                let yPos = doc.y;

                doc.fontSize(10)
                    .font('Helvetica')
                    .fillColor('#6b7280')
                    .text('Transaction ID:', leftColumn, yPos);
                doc.font('Helvetica-Bold')
                    .fillColor('#1f2937')
                    .text(data.transactionId, rightColumn, yPos);

                yPos += 20;
                doc.font('Helvetica')
                    .fillColor('#6b7280')
                    .text('Reference Number:', leftColumn, yPos);
                doc.font('Helvetica-Bold')
                    .fillColor('#1f2937')
                    .text(data.referenceId, rightColumn, yPos);

                yPos += 20;
                doc.font('Helvetica')
                    .fillColor('#6b7280')
                    .text('Date & Time:', leftColumn, yPos);
                doc.font('Helvetica-Bold')
                    .fillColor('#1f2937')
                    .text(data.date.toLocaleString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                    }), rightColumn, yPos);

                doc.y = yPos + 30;

                // Parties Section
                doc.fontSize(12)
                    .font('Helvetica-Bold')
                    .fillColor('#1f2937')
                    .text('PARTIES INVOLVED', leftColumn);

                doc.moveDown(0.5);
                doc.strokeColor('#e5e7eb')
                    .lineWidth(0.5)
                    .moveTo(50, doc.y)
                    .lineTo(545, doc.y)
                    .stroke();

                doc.moveDown(1);
                yPos = doc.y;

                doc.fontSize(10)
                    .font('Helvetica')
                    .fillColor('#6b7280')
                    .text('From (Sender):', leftColumn, yPos);
                doc.font('Helvetica-Bold')
                    .fillColor('#1f2937')
                    .text(data.senderName, rightColumn, yPos);

                yPos += 20;
                doc.font('Helvetica')
                    .fillColor('#6b7280')
                    .text(data.isGroupDonation ? 'To (Beneficiary):' : 'To (Recipient):', leftColumn, yPos);
                doc.font('Helvetica-Bold')
                    .fillColor('#1f2937')
                    .text(data.recipientName, rightColumn, yPos);

                doc.y = yPos + 30;

                // Fundraising Progress Section (for group donations)
                if (data.isGroupDonation && data.fundraisingTarget && data.currentProgress !== undefined) {
                    doc.fontSize(12)
                        .font('Helvetica-Bold')
                        .fillColor('#1f2937')
                        .text('FUNDRAISING PROGRESS', leftColumn);

                    doc.moveDown(0.5);
                    doc.strokeColor('#e5e7eb')
                        .lineWidth(0.5)
                        .moveTo(50, doc.y)
                        .lineTo(545, doc.y)
                        .stroke();

                    doc.moveDown(1);
                    yPos = doc.y;

                    const progressPercentage = data.fundraisingTarget > 0 
                        ? Math.min((data.currentProgress / data.fundraisingTarget) * 100, 100) 
                        : 0;

                    doc.fontSize(10)
                        .font('Helvetica')
                        .fillColor('#6b7280')
                        .text('Current Amount:', leftColumn, yPos);
                    doc.font('Helvetica-Bold')
                        .fillColor('#10b981')
                        .text(`${data.currency} ${data.currentProgress.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, rightColumn, yPos);

                    yPos += 20;
                    doc.font('Helvetica')
                        .fillColor('#6b7280')
                        .text('Target Amount:', leftColumn, yPos);
                    doc.font('Helvetica-Bold')
                        .fillColor('#1f2937')
                        .text(`${data.currency} ${data.fundraisingTarget.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, rightColumn, yPos);

                    yPos += 20;
                    doc.font('Helvetica')
                        .fillColor('#6b7280')
                        .text('Progress:', leftColumn, yPos);
                    doc.font('Helvetica-Bold')
                        .fillColor(progressPercentage >= 100 ? '#10b981' : '#2563eb')
                        .text(`${progressPercentage.toFixed(1)}%`, rightColumn, yPos);

                    // Progress bar visualization
                    yPos += 25;
                    const barWidth = 495;
                    const barHeight = 20;
                    const filledWidth = (barWidth * progressPercentage) / 100;

                    // Background bar
                    doc.fillColor('#e5e7eb')
                        .rect(leftColumn, yPos, barWidth, barHeight)
                        .fill();

                    // Filled portion
                    if (filledWidth > 0) {
                        doc.fillColor(progressPercentage >= 100 ? '#10b981' : '#2563eb')
                            .rect(leftColumn, yPos, filledWidth, barHeight)
                            .fill();
                    }

                    // Percentage text on bar
                    doc.fontSize(9)
                        .font('Helvetica-Bold')
                        .fillColor('#ffffff')
                        .text(`${progressPercentage.toFixed(1)}%`, leftColumn, yPos + 5, { width: barWidth, align: 'center' });

                    doc.y = yPos + 35;
                }

                // Payment Details Section
                doc.fontSize(12)
                    .font('Helvetica-Bold')
                    .fillColor('#1f2937')
                    .text('PAYMENT BREAKDOWN', leftColumn);

                doc.moveDown(0.5);
                doc.strokeColor('#e5e7eb')
                    .lineWidth(0.5)
                    .moveTo(50, doc.y)
                    .lineTo(545, doc.y)
                    .stroke();

                doc.moveDown(1);
                yPos = doc.y;

                doc.fontSize(10)
                    .font('Helvetica')
                    .fillColor('#6b7280')
                    .text(data.isGroupDonation ? 'Donation Amount:' : 'Transfer Amount:', leftColumn, yPos);
                doc.font('Helvetica-Bold')
                    .fillColor('#1f2937')
                    .text(`${data.currency} ${data.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, rightColumn, yPos);

                yPos += 20;
                doc.font('Helvetica')
                    .fillColor('#6b7280')
                    .text('Transaction Fee:', leftColumn, yPos);
                doc.font('Helvetica-Bold')
                    .fillColor('#1f2937')
                    .text(`${data.currency} ${data.fee.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, rightColumn, yPos);

                // Total Amount (highlighted)
                yPos += 30;
                doc.fillColor('#f3f4f6')
                    .rect(leftColumn - 10, yPos - 5, 505, 30)
                    .fill();

                doc.fontSize(12)
                    .font('Helvetica-Bold')
                    .fillColor('#1f2937')
                    .text('Total Amount:', leftColumn, yPos);
                doc.fillColor('#2563eb')
                    .text(`${data.currency} ${data.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, rightColumn, yPos);

                doc.y = yPos + 40;

                // Note Section (if exists)
                if (data.note) {
                    doc.fontSize(12)
                        .font('Helvetica-Bold')
                        .fillColor('#1f2937')
                        .text('TRANSACTION NOTE', leftColumn);

                    doc.moveDown(0.5);
                    doc.strokeColor('#e5e7eb')
                        .lineWidth(0.5)
                        .moveTo(50, doc.y)
                        .lineTo(545, doc.y)
                        .stroke();

                    doc.moveDown(0.5);
                    doc.fontSize(10)
                        .font('Helvetica')
                        .fillColor('#4b5563')
                        .text(data.note, leftColumn, doc.y, { width: 495, align: 'left' });

                    doc.moveDown(2);
                }

                // Footer
                doc.moveDown(3);
                const footerY = doc.page.height - 100;

                doc.strokeColor('#e5e7eb')
                    .lineWidth(0.5)
                    .moveTo(50, footerY)
                    .lineTo(545, footerY)
                    .stroke();

                doc.fontSize(8)
                    .font('Helvetica')
                    .fillColor('#9ca3af')
                    .text('This is a computer-generated receipt and does not require a signature.',
                        leftColumn, footerY + 10,
                        { width: 495, align: 'center' });

                doc.text('For any queries, please contact support with your transaction reference number.',
                    leftColumn, footerY + 25,
                    { width: 495, align: 'center' });

                doc.fontSize(7)
                    .text(`Generated on: ${new Date().toLocaleString('en-US')}`,
                        leftColumn, footerY + 45,
                        { width: 495, align: 'center' });

                // Finalize PDF
                doc.end();

            } catch (error) {
                reject(error);
            }
        });
    }

    static getReceiptFileName(transactionId: string, referenceId: string): string {
        const timestamp = new Date().toISOString().split('T')[0];
        return `receipt_${referenceId}_${timestamp}.pdf`;
    }
}
