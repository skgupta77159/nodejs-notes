# 4. Async Error Handling

With Express, async errors need to reach the central handler.

A reusable wrapper is useful:

```js
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next))
      .catch(next);
  };
};
```

Usage:

```js
app.get(
  "/users/:id",
  asyncHandler(async (req, res) => {
    const user = await getUser(req.params.id);

    if (!user) {
      throw new NotFoundError("User", {
        userId: req.params.id
      });
    }

    res.json(user);
  })
);
```

Now this:

```js
throw new Error("Database failed");
```

automatically goes to:

```js
app.use((err, req, res, next) => {
  // central error handler
});
```

You don't need to write `try/catch` in every controller.

---