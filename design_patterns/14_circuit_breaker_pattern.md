# 14. Circuit Breaker Pattern ⭐

This is particularly important in **microservices**.

Suppose:

```text
Order Service
      ↓
Payment Service
```

Payment Service becomes slow/down.

Without protection:

```text
Request
 ↓
Order
 ↓
Payment ❌
 ↓
timeout
 ↓
retry
 ↓
timeout
 ↓
retry
```

Thousands of requests can pile up.

Circuit breaker changes behavior:

```text
             Payment
                ↓
        ┌───────┴───────┐
        ↓               ↓
     Healthy          Failure
        ↓               ↓
     Request          Circuit OPEN
                        ↓
                    Fail Fast
```

Basic concept:

```js
class CircuitBreaker {

    constructor(action, threshold = 3) {
        this.action = action;
        this.threshold = threshold;
        this.failures = 0;
        this.open = false;
    }

    async execute() {

        if (this.open) {
            throw new Error("Circuit is open");
        }

        try {

            const result = await this.action();

            this.failures = 0;

            return result;

        } catch (error) {

            this.failures++;

            if (this.failures >= this.threshold) {
                this.open = true;
            }

            throw error;
        }
    }
}
```

Production implementations normally also have:

```text
CLOSED
   ↓ failures
OPEN
   ↓ timeout
HALF-OPEN
   ↓ success
CLOSED
```

---