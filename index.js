const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const app = express();
const port = process.env.PORT || 5000;

// middleware

app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: [
    'http://localhost:5173',
  ],
  credentials: true
}));


const logger = (req, res, next) => {
  console.log('log info: ', req.method, req.url);
  next();
}

const verifyToken = (req, res, next) => {
  const token = req.cookies?.token
  console.log('token verify', token);
  if (!token) {
    return res.status(401).send({ message: 'unauthorized access' })
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: 'unauthorized access' })
    }
    req.user = decoded;
    next();
  })
}
//===========


app.get('/', (req, res) => {
  res.send("Server is running")
})
app.listen(port, () => {
  console.log(`Server is running on port ${port}`)
})
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.6b1wars.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
};

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    //creating Token
    // app.post("/jwt", async (req, res) => {
    //   try {
    //     const user = req.body;
    //     console.log("user for token", user);
    //     const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
    //       expiresIn: '1h'
    //     });

    //     res.cookie("token", token, cookieOptions)
    //       .send({ success: true });
    //   } catch (error) {
    //     res.status(500).send({ success: false })
    //   }
    // });

    // //clearing Token
    // app.post("/logout", async (req, res) => {
    //   const user = req.body;
    //   console.log("logging out", user);
    //   res
    //     .clearCookie("token", { ...cookieOptions, maxAge: 0 })
    //     .send({ success: true });
    // });

    // User CRUD operations
    const users = client.db('talent-syncro').collection('users');

    app.get('/user', async (req, res) => {
      const cursor = users.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get('/user/:email', async (req, res) => {
      try {
        const email = req.params.email;
        const user = await users.findOne({ email: email });

        if (!user) {
          return res.status(404).send({ message: "User not found" });
        }
        res.send(user);
      }
      catch (error) {
        res.status(500).send({ message: "An error occurred", error: error.message });
      }
    });

    app.post('/user', async (req, res) => {
      try {
        const newUser = req.body;
        console.log("New user: ", newUser);
        const existingUser = await users.findOne({ email: newUser.email });

        if (existingUser) {
          res.status(400).send({ message: "Email already in use" });
        } else {
          const result = await users.insertOne(newUser);
          res.send(result);
        }
      } catch (error) {
        console.error("Error inserting user: ", error);
        res.status(500).send({ message: "An error occurred while inserting the user" });
      }
    });

    app.put('/user/:id', async (req, res) => {
      try {
        const id = req.params.id;
        const { isVerified } = req.body;
        const query = { _id: new ObjectId(id) };
        const update = { $set: { isVerified } };
        const result = await users.updateOne(query, update);

        if (result.matchedCount === 0) {
          return res.status(404).json({ message: 'Employee not found' });
        }

        res.json({ message: 'Employee verification updated successfully' });
      } catch (error) {
        console.error('Error updating employee verification:', error);
        res.status(500).json({ message: 'An error occurred while updating employee verification' });
      }
    });

    app.delete('/user/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await users.deleteOne(query);
      res.send(result);
    });

    // work sheet CRUD operations
    const workSheets = client.db('talent-syncro').collection('work-sheet');
    app.get('/work-sheet', async (req, res) => {
      const cursor = workSheets.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get('/work-sheet/:userId', async (req, res) => {
      const userId = req.params.userId;
      const query = { userId: userId };
      const result = await workSheets.find(query).toArray();
      res.send(result);
    });

    app.post('/work-sheet', async (req, res) => {
      const newWorkSheets = req.body;
      const result = await workSheets.insertOne(newWorkSheets);
      res.send(result);
    });

    app.delete('/work-sheet/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await workSheets.deleteOne(query);
      res.send(result);
    });

    // payment history CRUD operations
    const payments = client.db('talent-syncro').collection('payment');

    app.get('/payment', async (req, res) => {
      const cursor = payments.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get('/payment/:id', async (req, res) => {
      const employeeId = req.params.id;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 0;

      try {
        const query = { employeeId: employeeId };
        const cursor = payments.find(query).sort({ date: 1 });

        const result = limit > 0 ? await cursor.skip((page - 1) * limit).limit(limit).toArray() : await cursor.toArray();

        const total = await payments.countDocuments(query);

        res.send({
          history: result,
          total
        });
      } catch (error) {
        res.status(500).send({ error: 'An error occurred while fetching payment history' });
      }
    });


    app.post('/payment', async (req, res) => {
      const newPayment = req.body;
      const result = await payments.insertOne(newPayment);
      res.send(result);
    });

    app.delete('/payment/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await payments.deleteOne(query);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);
