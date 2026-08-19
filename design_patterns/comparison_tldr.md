# Putting Multiple Patterns Together

This is where design patterns become really useful.

Consider an **e-commerce order system**:

```text
                 HTTP Request
                      │
                      ↓
                 Middleware
                      │
                      ↓
                 Controller
                      │
                      ↓
                 Order Service
                      │
             ┌────────┼────────┐
             ↓        ↓        ↓
        Repository  Strategy  Facade
             │        │        │
             ↓        ↓        ↓
           DB      Payment   Inventory
                      │
                 ┌────┴────┐
                 ↓         ↓
              Stripe    Razorpay
              Adapter   Adapter
```

You can use:

### Middleware

For:

```text
Authentication
Validation
Rate limiting
Logging
```

### Controller

Responsible for:

```text
HTTP request/response
```

### Service

Responsible for:

```text
Business logic
```

### Repository

Responsible for:

```text
Database access
```

### Strategy

Responsible for:

```text
Choosing payment/shipping algorithm
```

### Adapter

Responsible for:

```text
Third-party API compatibility
```

### Facade

Responsible for:

```text
Simplifying complex workflows
```

### Observer

Responsible for:

```text
Notifications/events
```

---

# A Practical Node.js Example

Imagine:

```text
POST /orders
```

Request:

```json
{
    "items": [
        {
            "productId": 10,
            "quantity": 2
        }
    ],
    "paymentProvider": "stripe"
}
```

A good architecture could be:

```text
                    POST /orders
                         │
                         ↓
                    Controller
                         │
                         ↓
                    OrderService
                         │
              ┌──────────┼──────────┐
              ↓          ↓          ↓
        OrderRepository Payment    EventEmitter
              │        Strategy        │
              ↓           │            ↓
             DB       PaymentAdapter   Email
                            │
                          Stripe
```

Example:

```js
class OrderService {

    constructor(
        orderRepository,
        paymentFactory,
        eventEmitter
    ) {
        this.orderRepository = orderRepository;
        this.paymentFactory = paymentFactory;
        this.eventEmitter = eventEmitter;
    }

    async createOrder(data) {

        // 1. Business validation
        if (!data.items?.length) {
            throw new Error("Cart is empty");
        }

        // 2. Create payment provider
        const payment =
            this.paymentFactory.create(
                data.paymentProvider
            );

        // 3. Calculate amount
        const amount = 1000;

        // 4. Payment
        await payment.pay(amount);

        // 5. Save order
        const order =
            await this.orderRepository.create({
                items: data.items,
                amount
            });

        // 6. Notify subscribers
        this.eventEmitter.emit(
            "order.created",
            order
        );

        return order;
    }
}
```

This single service is using concepts from multiple patterns.

---

# Design Pattern vs Architecture

This is another important interview distinction.

### Design Pattern

Solves a **specific design problem**.

Examples:

```text
Factory
Strategy
Observer
Adapter
Decorator
```

### Architecture

Defines the **overall structure of the application**.

Examples:

```text
MVC
Clean Architecture
Hexagonal Architecture
Microservices
Layered Architecture
```

For example:

```text
Clean Architecture
        │
        ├── Controller
        ├── Use Case
        ├── Repository
        └── Infrastructure
                    │
                    └── PostgreSQL
```

Inside that architecture you can still use:

```text
Factory
Strategy
Adapter
Observer
Dependency Injection
```

---

# Common Interview Questions

### 1. Factory vs Strategy?

**Factory**

> Decides **which object to create**.

**Strategy**

> Decides **which behavior/algorithm to use**.

```text
Factory → object creation

Strategy → behavior selection
```

---

### 2. Adapter vs Facade?

**Adapter:**

```text
Different interface
        ↓
Compatible interface
```

**Facade:**

```text
Complex subsystem
        ↓
Simple interface
```

---

### 3. Observer vs Pub/Sub?

Observer usually works within the same application/process:

```text
EventEmitter
```

Pub/Sub is commonly used for distributed communication:

```text
Redis
Kafka
RabbitMQ
```

---

### 4. Singleton vs Dependency Injection?

Singleton:

```text
"Give me the same instance."
```

Dependency Injection:

```text
"Give me whatever implementation I need."
```

DI generally gives better testability and flexibility.

---

### 5. Why shouldn't we use design patterns everywhere?

Because patterns introduce abstraction.

Bad:

```text
Simple function
      ↓
Factory
      ↓
Strategy
      ↓
Adapter
      ↓
Proxy
```

when all you needed was:

```js
calculatePrice();
```

A good interview answer:

> Design patterns should solve an actual complexity problem. Applying patterns unnecessarily can make simple code harder to understand and maintain.

---

# ⭐ Interview TL;DR

If asked **"What design patterns have you used in Node.js?"**, you can answer:

> "In Node.js applications, I've commonly used Repository and Dependency Injection to separate database access from business logic and make services testable. Strategy and Factory are useful when we have multiple implementations such as payment or storage providers. Adapter is useful for integrating third-party APIs with our application's interface. EventEmitter follows the Observer pattern for in-process events, while queues or message brokers are better for distributed events. Express middleware is also closely related to Chain of Responsibility. For production microservices, Circuit Breaker can prevent cascading failures."

### Remember this mapping:

```text
Factory       → Which object?
Strategy      → Which behavior?
Adapter       → Make interfaces compatible
Facade        → Simplify complexity
Repository    → Hide database
DI            → Reduce coupling
Observer      → Notify subscribers
Middleware    → Request pipeline
Decorator     → Add behavior
Proxy         → Control access
Command       → Encapsulate an action
Singleton     → One instance per process
Circuit Breaker → Stop cascading failures
```

**For a senior Node.js interview, don't just define the pattern.** Explain **what problem it solves, why you chose it, what happens at scale, and what trade-off it introduces**. That is usually much stronger than simply naming patterns.
