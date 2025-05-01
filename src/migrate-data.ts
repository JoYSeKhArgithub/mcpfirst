// Import necessary modules
import Database from "better-sqlite3";  // SQLite database driver
import { join, resolve } from "path";   // Path utilities
import mongoose from "mongoose";        // MongoDB ODM
import { TodoModel } from "./models/Todo.js";  // Todo model

// Define interface for SQLite todos to ensure type safety
interface SQLiteTodo {
  id: number;             // SQLite primary key
  text: string;           // Todo content
  priority?: string;      // Optional priority (might not exist in old data)
  createdAt?: string;     // Optional timestamp (might not exist)
}

// Main migration function
async function migrateData() {
  // Connect to MongoDB
  await mongoose.connect('mongodb://localhost:27017/todo-mcp');
  console.log('Connected to MongoDB');
  
  // Connect to SQLite database
  const DB_LOCATION = "D:/ProjectThoughts/todos";  // Old database location
  const dataDir = resolve(DB_LOCATION);
  const dbPath = join(dataDir, "todos.db");
  const db = new Database(dbPath);
  
  // Get all todos from SQLite
  const sqliteTodos = db.prepare("SELECT * FROM todos").all() as SQLiteTodo[];
  console.log(`Found ${sqliteTodos.length} todos in SQLite`);
  
  // Migrate to MongoDB
  let migratedCount = 0;
  
  // Process each todo from SQLite
  for (const todo of sqliteTodos) {
    // Create new document in MongoDB
    await TodoModel.create({
      text: todo.text,                                // Copy text
      priority: todo.priority || 'medium',            // Use priority or default
      createdAt: todo.createdAt || new Date().toISOString(), // Use timestamp or current time
      displayId: todo.id                              // Preserve original ID as displayId
    });
    migratedCount++;
  }
  
  // Log success and exit
  console.log(`Successfully migrated ${migratedCount} todos to MongoDB`);
  process.exit(0);
}

// Run migration and handle errors
migrateData().catch(error => {
  console.error('Migration failed:', error);
  process.exit(1);
}); 