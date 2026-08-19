# 13. Command Pattern

Command encapsulates an operation as an object/function.

Very useful for:

```text
Background jobs
Queues
Undo/redo
Task scheduling
Audit logs
```

Example:

```js
class SendEmailCommand {

    constructor(emailService, email) {
        this.emailService = emailService;
        this.email = email;
    }

    async execute() {
        return this.emailService.send(this.email);
    }
}
```

Then a queue worker can execute:

```js
const command = new SendEmailCommand(
    emailService,
    {
        to: "user@example.com",
        subject: "Order Created"
    }
);

await command.execute();
```

In production this concept works nicely with:

```text
BullMQ
RabbitMQ
Kafka
SQS
```

---