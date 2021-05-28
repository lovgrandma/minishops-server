/**
 * Administrator file for template queries to create and manage shops on neo4j and mongoDb users.js
 * @version 0.0.1
 * @author jesse Thompson
 */

/**************************************** */
//Creating a single shop with shop Stripe payment account

/**
 * Builds shop belonging to user on neo4j to allow them to begin configuring their shop
 * Ledger will contain a list of all users transactions, application will delete transactions (complete or uncomplete) after 1 year. 
 * Products are not on shop, they are individual records connected to shop record
 */

// Whenever you build a shop, make sure to create default vendor payment account 
const createSingleShopAndAttachToAccount = () => {
    return "create (a:Shop { id: $id, name: $name, ledger: [], authorized: true, publishDate: $publishDate, description: $description, icon: $icon, shippingClasses: [], origins: [] }) with a match (b:Person {name: $name }) with a, b merge (b)-[r:OWNS]-(a) return a, r, b";
}

/**
 * Will enforce a Singleton express account on a shop account
 * @param {String} username 
 * @returns {String}
 */
const retrieveExpressVendorAcc = async function(username) {
    try {
        let oldUser = await User.findOne({ username: username }).lean();
        if (!oldUser.vendorPayment) { // Creates new vendor account if null
            // It is necessary that new vendor accounts are initiated with card_payments and transfers enabled. Or else they cannot receive payments
            const account = await stripe.accounts.create({
                type: 'express',
                capabilities: {
                    card_payments: {
                        requested: true,
                    },
                    transfers: {
                        requested: true,
                    }
                }
            });
            let updatedUser = await User.findOneAndUpdate({ username: username}, { vendorPayment: account.id }, { new: true }).lean();
            return updatedUser.vendorPayment;
        } else {
            return oldUser.vendorPayment; // Returns vendor account if existing
        }
    } catch (err) {
        return null;
    }
}

/*************************************** */