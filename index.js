const express = require('express')
const app = express()
const cors = require('cors');
var jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000
require('dotenv').config();
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY)

//middleware
app.use(cors());
app.use(express.json())

const verifyJwt = (req, res, next) =>{
   const authorization = req.headers.authorization;

   if(!authorization){
    return res.status(401).send({ error : true, message : "unauthorized access" })
   }

   const token = authorization.split(' ')[1];

   jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if(err){
      return res.status(401).send({ error : true, message : "unauthorized access" })
    }

    req.decoded = decoded;
    next();
   })
}

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.lek3e6k.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const usersCollection = client.db('assignment-12').collection('users');
    const classCollection = client.db('assignment-12').collection('classes');
    const selectedClassCollection = client.db('assignment-12').collection('selectedClasses');
    const paymentsCollection = client.db('assignment-12').collection('payments');

    const verifyAdmin = async(req, res, next) =>{
      const email = req.decoded.email;
      const query = {email : email};
      const user = await usersCollection.findOne(query);

      if(user?.role !== 'admin'){
        return res.status(403).send({error : true, message : 'forbidden email'})
      }
      next();
    } 


    app.get('/users', verifyJwt, verifyAdmin, async(req, res) =>{
      const result = await usersCollection.find().toArray()
      res.send(result)
    })

    app.post('/users', async (req, res) => {
        const user = req.body;

        const query = {email : user.email}
        const existingUser = await usersCollection.findOne(query);
        if(existingUser){
          return res.send({message : 'user already exist'})
        }

        const result = await usersCollection.insertOne(user);
        res.send(result);
    })

    app.post('/jwt', (req, res) =>{
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
      res.send({ token })
    })

    app.get('/users/admin/:email', verifyJwt, async(req, res) =>{
      const email = req.params.email;

      if(req.decoded.email !== email){
        res.send({admin : false})
      }

      const query = {email : email}

      const user = await usersCollection.findOne(query)
      const result = {admin : user?.role === 'admin'}
      res.send(result);
    })

    app.get('/users/instructor/:email', verifyJwt, async(req, res) =>{
      const email = req.params.email;

      if(req.decoded.email !== email){
        res.send({instructor : false})
      }

      const query = {email : email}

      const user = await usersCollection.findOne(query)
      const result = {instructor : user?.role === 'instructor'}
      res.send(result);
    })

    app.patch('/users/admin/:id', async(req, res) =>{
      const id = req.params.id;
      const filter = {_id : new ObjectId(id)}
      const updateDoc = {
        $set: {
          role: 'admin'
        },
      };

      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result)
    })

    app.patch('/users/instructor/:id', async(req, res) =>{
      const id = req.params.id;
      const filter = {_id : new ObjectId(id)}
      const updateDoc = {
        $set: {
          role: 'instructor'
        },
      };

      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result)
    })

    app.delete('/users/:id', async(req, res) =>{
       const id = req.params.id;
       const filter = {_id : new ObjectId(id)}

       const result = await usersCollection.deleteOne(filter);
       res.send(result)
    })

    app.get('/classes', async(req, res) =>{
      const result = await classCollection.find().toArray()
      res.send(result)
    })

    app.get('/classes/popular', async(req, res) =>{
      const result = await classCollection.find().sort({student : -1}).limit(6).toArray()
      res.send(result)
    })

    app.patch('/classes/approve/:id', async(req, res) =>{
       const id = req.params.id;

       const filter = {_id : new ObjectId(id)}
      const updateDoc = {
        $set: {
          status: 'approved'
        },
      };

      const result = await classCollection.updateOne(filter, updateDoc);
      res.send(result)
    })

    app.get('/classes/approve', async(req, res) =>{
       const query = {status : 'approved'}
       const result = await classCollection.find(query).toArray();
       res.send(result)
    })

    app.get('/users/instructors', async(req, res) =>{
       const query = {role : 'instructor'}
       const result = await usersCollection.find(query).toArray();
       res.send(result)
    })

    app.get('/users/popular/instructors', async(req, res) =>{
       const query = {role : 'instructor'}
       const result = await usersCollection.find(query).limit(6).toArray();
       res.send(result)
    })

    app.patch('/classes/deny/:id', async(req, res) =>{
       const id = req.params.id;

       const filter = {_id : new ObjectId(id)}
      const updateDoc = {
        $set: {
          status: 'denied'
        },
      };

      const result = await classCollection.updateOne(filter, updateDoc);
      res.send(result)
    })

    app.put('/classes/feedback/:id', async(req, res) =>{
       const id = req.params.id;
       const feedback = req.body;

       const filter = {_id : new ObjectId(id)}
      const updateDoc = {
        $set: {
          feedback: feedback
        },
      };

      const result = await classCollection.updateOne(filter, updateDoc);
      res.send(result)
    })

    app.get('/classes/:email', async(req, res) =>{
      const email = req.params.email;
      
      const query = {email : email}
      const result = await classCollection.find(query).toArray();
      res.send(result)
      
   })

    app.get('/classes/:email/:id', async(req, res) =>{
      const id = req.params.id;
    
    const query = {_id : new ObjectId(id)}
    const result = await classCollection.findOne(query);
    res.send(result)
   })

   app.put('/classes/:email/:id', async(req, res) =>{
    const id = req.params.id;
    const filter = {_id : new ObjectId(id)}
    const options = { upsert: true };
    const updatedData = req.body;

    const updateDoc = {
     $set: {
     className : updatedData.name,
     price : updatedData.price,
     seats : updatedData.seats
   },
 };
 const result = await classCollection.updateOne(filter, updateDoc, options);
 res.send(result)
 })

   app.post('/selected', async(req, res) =>{
    const selectedClass = req.body;
       const result = await selectedClassCollection.insertOne(selectedClass)
       res.send(result)
   })

   app.get('/selected/:email', async(req, res) =>{
    const email = req.params.email;
    
    const query = {selectedBy : email}
    const result = await selectedClassCollection.find(query).toArray();
    res.send(result) 
 })

   app.get('/selected/:email/:id', async(req, res) =>{
    const id = req.params.id;
    
    const query = {_id : new ObjectId(id)}
    const result = await selectedClassCollection.findOne(query);
    res.send(result)
 })

 app.put('/selected/pay/:id', async(req, res) =>{
  const id = req.params.id;
  const body = req.body;
  const filter = {_id : new ObjectId(id)}
  const options = { upsert: true };

  const updateDoc = {
   $set: body
};
const result = await classCollection.updateOne(filter, updateDoc, options);
res.send(result)
})


 app.delete('/selected/:id', async(req, res) =>{
       const id = req.params.id;
       const filter = {_id : new ObjectId(id)}

       const result = await selectedClassCollection.deleteOne(filter);
       res.send(result)
    })

    app.post('/classes', async(req, res) =>{
       const newClass = req.body;
       const result = await classCollection.insertOne(newClass)
       res.send(result)
    })

    app.post('/create-payment-intent', verifyJwt, async (req, res) => {
      const { price } = req.body;
      const amount = price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']
      });

      res.send({
        clientSecret: paymentIntent.client_secret
      })
    })

    app.get('/payments/:email', async(req, res) =>{
      const email = req.params.email;

      const query = {email : email}
      const result = await paymentsCollection.find(query).sort({date: -1}).toArray();
      res.send(result)
    })

    app.post('/payments', verifyJwt, async(req, res) =>{
      const payment = req.body;
      const result = await paymentsCollection.insertOne(payment)
      res.send(result)
    })

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Assignment 12 is Running')
})

app.listen(port, () => {
    console.log(`Assignment 12 is running on port ${port}`)
})