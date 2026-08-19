# 4. Strategy Pattern ⭐

This is one of the most important patterns for interviews.

Strategy means:

> Define multiple interchangeable algorithms and select one at runtime.

### Real-world example

An e-commerce application calculates shipping differently:

```text
Normal Shipping
Express Shipping
International Shipping
```

Instead of:

```js
if (type === "normal") {
   ...
} else if (type === "express") {
   ...
}
```

Use strategies.

```js
class NormalShipping {
    calculate(order) {
        return 50;
    }
}

class ExpressShipping {
    calculate(order) {
        return 150;
    }
}

class InternationalShipping {
    calculate(order) {
        return 500;
    }
}
```

Then:

```js
class ShippingService {
    constructor(strategy) {
        this.strategy = strategy;
    }

    calculate(order) {
        return this.strategy.calculate(order);
    }
}
```

Usage:

```js
const shipping = new ShippingService(
    new ExpressShipping()
);

console.log(shipping.calculate(order));
```

### Why is this better?

You can add:

```text
DroneShipping
SameDayShipping
FreeShipping
```

without changing the core `ShippingService`.

### Interview answer

> Strategy allows us to change business logic without changing the code that consumes that logic.

---