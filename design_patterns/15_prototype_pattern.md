# 15. Prototype Pattern

### What problem does it solve?

The **Prototype Pattern** creates a new object by **cloning an existing object (prototype)** rather than constructing everything from scratch.

JavaScript is fundamentally prototype-based, so this pattern is especially relevant to Node.js.

### Simple example

```js
const userPrototype = {
    role: "user",
    permissions: ["read"],

    clone() {
        return {
            ...this,
            permissions: [...this.permissions]
        };
    }
};

const admin = userPrototype.clone();

admin.role = "admin";
admin.permissions.push("write");

console.log(admin);
```

Output:

```text
{
  role: "admin",
  permissions: ["read", "write"]
}
```

The important part is that we create a new object based on an existing object.

---

### Real-world example

Imagine an application has predefined document templates:

```text
Invoice Template
 ├── company information
 ├── formatting
 ├── tax configuration
 └── footer

Clone → Customer Invoice
Clone → Vendor Invoice
Clone → International Invoice
```

Instead of rebuilding the configuration every time:

```js
const invoiceTemplate = {
    currency: "INR",
    tax: 18,
    footer: "Thank you",
    items: []
};

function cloneInvoice() {
    return structuredClone(invoiceTemplate);
}

const invoice1 = cloneInvoice();
const invoice2 = cloneInvoice();
```

Now each invoice starts from the same prototype/template.

### Important JavaScript distinction

Don't confuse:

```text
Prototype Pattern
```

with:

```text
JavaScript's prototype chain
```

They are related conceptually but aren't exactly the same thing.

JavaScript's prototype mechanism:

```js
const user = {
    name: "Sushil"
};

const admin = Object.create(user);

console.log(admin.name);
// Sushil
```

Here:

```text
admin
  ↓ [[Prototype]]
user
```

The property is inherited through the prototype chain.

### Interview answer

> Prototype Pattern creates new objects by cloning an existing object instead of constructing them from scratch. JavaScript naturally supports prototype-based inheritance, so concepts like `Object.create()` and prototype chains are closely related, although the Prototype design pattern itself is specifically about object cloning.

---