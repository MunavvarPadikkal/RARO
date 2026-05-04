const mongoose = require("mongoose");
const Wallet = require("../models/walletSchema");


/**
 * Get user wallet or create one if it doesn't exist.
 */
const getWallet = async (userId) => {
    let wallet = await Wallet.findOne({ userId });
    if (!wallet) {
        wallet = await Wallet.create({ userId, balance: 0, transactions: [] });
    }
    return wallet;
};

/**
 * Credit amount to user's wallet.
 */
const creditWallet = async (userId, amount, reason, orderId = null) => {
    if (amount <= 0) return;

    const wallet = await getWallet(userId);
    wallet.balance += amount;
    wallet.transactions.push({
        amount,
        type: "credit",
        reason,
        orderId,
        date: new Date(),
    });

    await wallet.save();
    return wallet;
};

/**
 * Debit amount from user's wallet.
 */
const debitWallet = async (userId, amount, reason, orderId = null) => {
    if (amount <= 0) return;

    const wallet = await getWallet(userId);
    if (wallet.balance < amount) {
        throw new Error("Insufficient wallet balance.");
    }

    wallet.balance -= amount;
    wallet.transactions.push({
        amount,
        type: "debit",
        reason,
        orderId,
        date: new Date(),
    });

    await wallet.save();
    return wallet;
};

/**
 * Get paginated transactions for user.
 */
const getPaginatedTransactions = async (userId, page = 1, limit = 5) => {
    const skip = (parseInt(page) - 1) * limit;
    
    const result = await Wallet.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(userId) } },
        {
            $project: {
                balance: 1,
                totalTransactions: { $size: "$transactions" },
                transactions: {
                    $slice: [
                        { $reverseArray: "$transactions" },
                        skip,
                        limit
                    ]
                }
            }
        }
    ]);

    if (!result || result.length === 0) {
        const wallet = await getWallet(userId);
        return {
            balance: wallet.balance,
            transactions: [],
            totalTransactions: 0,
            currentPage: 1,
            totalPages: 0
        };
    }

    const data = result[0];
    return {
        balance: data.balance,
        transactions: data.transactions,
        totalTransactions: data.totalTransactions,
        currentPage: parseInt(page),
        totalPages: Math.ceil(data.totalTransactions / limit)
    };
};

module.exports = {
    getWallet,
    creditWallet,
    debitWallet,
    getPaginatedTransactions,
};
