# 6. Adapter Pattern ⭐

Adapter solves:

> Two systems have incompatible interfaces.

### Real-world example

Your application expects:

```js
payment.pay(amount)
```

But Stripe provides:

```js
stripe.charges.create(...)
```

and another provider provides:

```js
razorpay.orders.create(...)
```

Create adapters.

```js
class StripeAdapter {
    constructor(stripe) {
        this.stripe = stripe;
    }

    async pay(amount) {
        return this.stripe.charges.create({
            amount
        });
    }
}
```

Now your application can use:

```js
const payment = new StripeAdapter(stripe);

await payment.pay(500);
```

Your application doesn't need to know Stripe's API format.

### Architecture

```text
Application
     |
     ↓
Payment Interface
     |
 ┌───┴────┐
 ↓        ↓
Stripe   Razorpay
Adapter  Adapter
```

### Adapter vs Strategy

This is a common interview question.

**Adapter:**

> Makes an incompatible interface compatible.

**Strategy:**

> Allows different algorithms/behaviors to be swapped.

---