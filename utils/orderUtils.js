/**
 * Distributes a coupon discount proportionally across order items.
 * Handles rounding to ensure total distributed matches original discount.
 * 
 * @param {Array} items - Array of order items (with itemTotal and quantity)
 * @param {Number} totalDiscount - Total coupon discount amount
 * @param {Number} subtotal - Total items amount (sum of all itemTotals)
 * @returns {Array} - Items with added discount fields
 */
const distributeCouponDiscount = (items, totalDiscount, subtotal) => {
    if (totalDiscount <= 0) {
        return items.map(item => ({
            ...item,
            couponDiscountPerUnit: 0,
            totalCouponDiscount: 0,
            finalPricePerUnit: item.price,
            finalItemTotal: item.itemTotal
        }));
    }

    let distributedTotal = 0;
    const updatedItems = items.map((item, index) => {
        // Calculate proportional discount for this item
        // Round to 2 decimal places to avoid floating point issues
        let itemDiscount = Math.round((item.itemTotal / subtotal) * totalDiscount * 100) / 100;
        
        // Adjust for last item to ensure exact total match
        if (index === items.length - 1) {
            itemDiscount = Math.round((totalDiscount - distributedTotal) * 100) / 100;
        } else {
            distributedTotal += itemDiscount;
        }

        const totalCouponDiscount = itemDiscount;
        const finalItemTotal = Math.round((item.itemTotal - totalCouponDiscount) * 100) / 100;
        const finalPricePerUnit = Math.round((finalItemTotal / item.quantity) * 100) / 100;
        const couponDiscountPerUnit = Math.round((item.price - finalPricePerUnit) * 100) / 100;

        return {
            ...item,
            couponDiscountPerUnit,
            totalCouponDiscount,
            finalPricePerUnit,
            finalItemTotal
        };
    });

    return updatedItems;
};

module.exports = {
    distributeCouponDiscount
};
