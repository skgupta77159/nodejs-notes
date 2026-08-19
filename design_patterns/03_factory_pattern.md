# 3. Factory Pattern

Factory Pattern is used when object creation should be separated from the code that uses the object.

### Problem

Suppose your application supports:

```text
Stripe
Razorpay
PayPal
```

Without Factory:

```js
if (provider === "stripe") {
    payment = new StripePayment();
} else if (provider === "razorpay") {
    payment = new RazorpayPayment();
}
```

This logic gets repeated everywhere.

### Factory

```js
class StripePayment {
    pay(amount) {
        console.log(`Stripe payment: ${amount}`);
    }
}

class RazorpayPayment {
    pay(amount) {
        console.log(`Razorpay payment: ${amount}`);
    }
}

function createPaymentProvider(provider) {
    switch (provider) {
        case "stripe":
            return new StripePayment();

        case "razorpay":
            return new RazorpayPayment();

        default:
            throw new Error("Unsupported provider");
    }
}
```

Usage:

```js
const payment = createPaymentProvider("stripe");

payment.pay(500);
```

### Real-world architecture

```text
Order Service
      |
      ↓
Payment Factory
   ↙       ↘
Stripe   Razorpay
```

The Order Service doesn't need to know how each provider is constructed.

---