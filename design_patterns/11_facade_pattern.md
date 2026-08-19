# 11. Facade Pattern

Facade provides a **simple interface over a complicated subsystem**.

### E-commerce example

Creating an order may involve:

```text
Validate cart
 ↓
Check inventory
 ↓
Calculate price
 ↓
Process payment
 ↓
Create order
 ↓
Send email
 ↓
Update inventory
```

Instead of controller knowing everything:

```js
await inventory.check();
await pricing.calculate();
await payment.pay();
await orderRepository.create();
await email.send();
```

Create:

```js
class OrderFacade {

    async placeOrder(user, cart) {

        await this.inventory.check(cart);

        const price =
            await this.pricing.calculate(cart);

        await this.payment.pay(price);

        const order =
            await this.orderRepository.create({
                user,
                cart,
                price
            });

        await this.email.send(order);

        return order;
    }
}
```

Controller:

```js
app.post("/orders", async (req, res) => {

    const order = await orderFacade.placeOrder(
        req.user,
        req.body.cart
    );

    res.json(order);
});
```

The controller sees a simple:

```js
placeOrder()
```

instead of the entire subsystem.

---