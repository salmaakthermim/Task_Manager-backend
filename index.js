const express = require('express');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.z4bua.mongodb.net/?appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
});

const VALID_STATUSES = ['To-Do', 'In-Progress', 'Done'];
const VALID_PRIORITIES = ['Low', 'Medium', 'High'];

async function run() {
  try {
    await client.connect();
    const db = client.db('taskManagerDB');
    const tasksCollection = db.collection('tasks');

    // GET /tasks
    app.get('/tasks', async (req, res) => {
      try {
        const tasks = await tasksCollection.find().sort({ createdAt: -1 }).toArray();
        res.json(tasks);
      } catch {
        res.status(500).json({ error: 'Failed to fetch tasks' });
      }
    });

    // POST /tasks
    app.post('/tasks', async (req, res) => {
      try {
        const { title, description, status, priority, dueDate, createdBy } = req.body;

        if (!title || typeof title !== 'string' || title.trim() === '') {
          return res.status(400).json({ error: 'Title is required' });
        }
        if (status && !VALID_STATUSES.includes(status)) {
          return res.status(400).json({ error: `Status must be one of: ${VALID_STATUSES.join(', ')}` });
        }
        if (priority && !VALID_PRIORITIES.includes(priority)) {
          return res.status(400).json({ error: `Priority must be one of: ${VALID_PRIORITIES.join(', ')}` });
        }

        const now = new Date();
        const newTask = {
          title: title.trim(),
          description: description?.trim() || '',
          status: status || 'To-Do',
          priority: priority || 'Medium',
          dueDate: dueDate ? new Date(dueDate) : null,
          createdBy: createdBy?.trim() || '',
          createdAt: now,
          updatedAt: now,
        };

        const result = await tasksCollection.insertOne(newTask);
        res.status(201).json({ ...newTask, _id: result.insertedId });
      } catch {
        res.status(500).json({ error: 'Failed to create task' });
      }
    });

    // PATCH /tasks/:id
    app.patch('/tasks/:id', async (req, res) => {
      try {
        const { id } = req.params;
        if (!ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid task ID' });

        const { title, description, status, priority, dueDate, createdBy } = req.body;
        const updateFields = { updatedAt: new Date() };

        if (title && typeof title === 'string' && title.trim()) updateFields.title = title.trim();
        if (typeof description === 'string') updateFields.description = description.trim();
        if (status) {
          if (!VALID_STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status' });
          updateFields.status = status;
        }
        if (priority) {
          if (!VALID_PRIORITIES.includes(priority)) return res.status(400).json({ error: 'Invalid priority' });
          updateFields.priority = priority;
        }
        if (dueDate !== undefined) updateFields.dueDate = dueDate ? new Date(dueDate) : null;
        if (createdBy && typeof createdBy === 'string') updateFields.createdBy = createdBy.trim();

        const result = await tasksCollection.findOneAndUpdate(
          { _id: new ObjectId(id) },
          { $set: updateFields },
          { returnDocument: 'after' }
        );
        if (!result) return res.status(404).json({ error: 'Task not found' });
        res.json(result);
      } catch {
        res.status(500).json({ error: 'Failed to update task' });
      }
    });

    // DELETE /tasks/:id
    app.delete('/tasks/:id', async (req, res) => {
      try {
        const { id } = req.params;
        if (!ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid task ID' });
        const result = await tasksCollection.deleteOne({ _id: new ObjectId(id) });
        if (result.deletedCount === 0) return res.status(404).json({ error: 'Task not found' });
        res.json({ message: 'Task deleted successfully' });
      } catch {
        res.status(500).json({ error: 'Failed to delete task' });
      }
    });

    app.get('/', (req, res) => res.send('Task Manager API is running'));
    app.listen(port, () => console.log(`Server running on port ${port}`));
  } catch (err) {
    console.error('Failed to connect to MongoDB', err);
  }
}

run().catch(console.dir);
