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

module.exports = {
    getWallet,
    creditWallet,
    debitWallet,
};
