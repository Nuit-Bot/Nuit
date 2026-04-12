import chalk from "chalk"
import express from "express"

const app = express()

app.get("/", (req, res) => {
    res.send("Coming soon!")
})

app.listen(process.env.PORT || 8080, () => {
    console.log(chalk.green(`[Server] Running on port ${process.env.PORT || 8080}`))
})