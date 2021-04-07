/**
 * Administrator file for template queries to create and manage shops on neo4j and mongoDb users.js
 * @version 0.0.1
 * @author jesse Thompson
 */

/**
 * Builds shop belonging to user on neo4j to allow them to begin configuring their shop
 * Ledger will contain a list of all users transactions, application will delete transactions (complete or uncomplete) after 1 year. 
 * Products are not on shop, they are individual records connected to shop record
 */
const createSingleShopAndAttachToAccount = () => {
    return "create (a:Shop { name: $name, ledger: [], authorized: true, publishDate: $publishDate, description: $description, icon: $icon, origins: [] }) with a match (b:Person {name: $name }) with a, b merge (b)-[r:OWNS]-(a) return a, r, b";
}