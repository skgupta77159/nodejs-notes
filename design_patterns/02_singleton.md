# 2. Singleton Pattern

Singleton means:

> Only one instance of a particular object should exist within the application.

A common Node.js example is a **database connection manager**.

```js
class Database {
    constructor() {
        if (Database.instance) {
            return Database.instance;
        }

        this.connection = "DB Connection";

        Database.instance = this;
    }

    query(sql) {
        console.log("Executing:", sql);
    }
}

const db1 = new Database();
const db2 = new Database();

console.log(db1 === db2);
// true
```

### Real-world example

```text
Node.js Application
       |
       ↓
 Database Singleton
       |
       ↓
 PostgreSQL connection pool
```

You don't want every request to create a completely new database pool.

### Important Node.js point

Node's module caching also makes singleton-like behavior easy.

```js
// db.js

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

module.exports = pool;
```

Every module requiring `db.js` gets the cached module instance.

### Interview trap

Don't say:

> Singleton means only one database connection.

More accurately:

> Singleton means one instance of the object within a given application/process. A database pool may itself contain many physical connections.

---