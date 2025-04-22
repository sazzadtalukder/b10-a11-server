require('dotenv').config()
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const app = express();
const port = process.env.PORT || 5000

app.use(cors({
    origin: ['http://localhost:5173', 'https://b10a11-39519.web.app', 'https://b10a11-39519.firebaseapp.com/'],
    credentials: true
}))
app.use(express.json())
app.use(cookieParser())

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.rsgeo.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});
const verifyToken = (req, res, next) => {
    const token = req?.cookies?.token
    if (!token) {
        return res.status(401).send({ message: "Unauthorized access" })
    }
    jwt.verify(token, process.env.JWT_SECRET, (err, decode) => {
        if (err) {
            return res.status(401).send({ message: "Unauthorized access" })
        }
        req.user = decode;
        next();
    })
}
async function run() {
    const volunteerNeedPostCollections = client.db("volunteerDB").collection("volunteerNeedPosts");
    const volunteerRequestedCollections = client.db("volunteerDB").collection("volunteerRequested");
    try {
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '30h' })
            res
                .cookie('token', token, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === "production",
                    sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
                })
                .send({ success: true })
        })
        app.post('/logout', (req, res) => {
            res
                .clearCookie('token', {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === "production",
                    sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
                })
                .send({ success: true })
        })
        app.post('/addVolunteer', async (req, res) => {
            const volunteerNeedPost = req.body;
            console.log(volunteerNeedPost)
            const result = await volunteerNeedPostCollections.insertOne(volunteerNeedPost);
            res.send(result)
        })
        app.get('/allVolunteer', async (req, res) => {
            const title = req.query.title;
            const email = req.query.email;
            console.log(title)
            let query = {};
            if (title) {
                query = { title: title }
            }
            if (email) {
                query = {
                    organizerEmail: email
                }
                // if(req.user.email !== email){
                //     return res.status(403).send({message: "forbidden access"})
                // }
            }

            const result = await volunteerNeedPostCollections.find(query).toArray();

            res.send(result)
        })
        app.get('/allRequests', verifyToken, async (req, res) => {
            const email = req.query.email;
            const query = { volunteerEmail: email }
            if (req.user.email !== email) {
                return res.status(403).send({ message: "forbidden access" })
            }
            const result = await volunteerRequestedCollections.find(query).toArray();
            res.send(result)
        })
        app.get('/allVolunteer/:id', async (req, res) => {
            const id = req.params.id
            const query = {
                _id: new ObjectId(id)
            }

            const result = await volunteerNeedPostCollections.findOne(query)
            res.send(result)
        })
        app.post('/addVolunteerRequested/:id', async (req, res) => {
            const volunteerRequested = req.body;
            const id = req.params.id
            // const {_id} = volunteerRequested;

            const result = await volunteerRequestedCollections.insertOne(volunteerRequested)
            await volunteerNeedPostCollections.updateOne({ _id: new ObjectId(id) }, { $inc: { volunteersNeeded: -1 } })
            res.send(result)
        })
        app.put('/updatePost/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const options = { upsert: true };
            const updatePost = {
                $set: {

                    thumbnail: req.body.thumbnail,
                    title: req.body.title,
                    description: req.body.description,
                    category: req.body.category,
                    location: req.body.location,
                    volunteersNeeded: req.body.volunteersNeeded,
                    deadline: req.body.deadline,
                    organizerName: req.body.organizerName,
                    organizerEmail: req.body.organizerEmail
                }
            }
            const result = await volunteerNeedPostCollections.updateOne(filter, updatePost, options)
            res.send(result)
        })
        app.delete('/allVolunteer/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await volunteerNeedPostCollections.deleteOne(query)
            res.send(result)
        })
        app.delete('/allRequests/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await volunteerRequestedCollections.deleteOne(query)
            res.send(result)
        })
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {

    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Server id running')
})
app.listen(port, () => console.log('server is running at port ', port))
