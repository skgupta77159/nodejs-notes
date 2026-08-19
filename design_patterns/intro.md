# Node.js Design Patterns — Interview & Production Notes

## 1. What is a Design Pattern?

A **design pattern** is a reusable solution to a commonly occurring software design problem.

It is **not a library or framework**.

For example:

```text
Problem:
Multiple payment providers need to be supported.

Bad:
if (provider === "stripe") { ... }
else if (provider === "razorpay") { ... }
else if (provider === "paypal") { ... }

Better:
PaymentService
      ↓
PaymentStrategy
   ↙   ↓    ↘
Stripe Razorpay PayPal
```

The second approach uses the **Strategy Pattern**.

---

# Important Node.js Design Patterns

For Node.js interviews, focus particularly on:

| Pattern                 | Main Purpose                      | Real-world Example  |
| ----------------------- | --------------------------------- | ------------------- |
| Module                  | Encapsulation                     | User service        |
| Singleton               | One shared instance               | Database connection |
| Factory                 | Create objects dynamically        | Payment provider    |
| Strategy                | Interchangeable algorithms        | Payment methods     |
| Observer                | Notify multiple listeners         | Events              |
| Adapter                 | Make incompatible APIs compatible | Third-party APIs    |
| Repository              | Separate DB logic                 | UserRepository      |
| Dependency Injection    | Reduce coupling                   | Inject DB/service   |
| Middleware              | Process request pipeline          | Authentication      |
| Decorator               | Add behavior dynamically          | Logging/cache       |
| Facade                  | Simplify complex subsystem        | Order service       |
| Chain of Responsibility | Pass request through handlers     | Express middleware  |
| Proxy                   | Control access to another object  | Cache/auth          |
| Command                 | Encapsulate an action             | Background jobs     |
| Circuit Breaker         | Protect from failing services     | Microservices       |

Let's go through the important ones.

---