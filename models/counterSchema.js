const mongoose = require("mongoose");
const { Schema } = mongoose;

const counterSchema = new Schema({
    _id: {
        type: String,
        required: true,
    },
    seq: {
        type: Number,
        default: 100000,
    },
});

/**
 * Atomically increment and return the next sequence value.
 * Creates the counter document if it doesn't exist yet.
 *
 * @param {string} counterName – The counter identifier (e.g. "invoiceNumber")
 * @returns {Promise<number>} – The next sequence number
 */
counterSchema.statics.getNextSequence = async function (counterName) {
    const counter = await this.findByIdAndUpdate(
        counterName,
        { $inc: { seq: 1 } },
        { new: true, upsert: true, returnDocument: 'after' }
    );
    return counter.seq;
};

const Counter = mongoose.model("Counter", counterSchema);
module.exports = Counter;
