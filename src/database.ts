import mongoose from 'mongoose';
import { join, resolve } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { TodoModel, ITodo } from './models/Todo.js';

// Define the Todo interface for your application
// This is the shape of todo items returned to the client
export interface Todo {
    id: string;           // MongoDB _id as string
    text: string;         // Text content of todo
    priority: 'high' | 'medium' | 'low';  // Priority with type safety
    createdAt: string;    // Creation timestamp
    displayId?: number;   // Optional user-facing ID for compatibility with previous system
}

// MongoDB connection string - local MongoDB instance
const MONGODB_URI = 'mongodb://localhost:27017/todo-mcp';

// Connect to MongoDB with async function
export const connectDB = async (): Promise<void> => {
  try {
    await mongoose.connect(MONGODB_URI);  // Establish connection
    console.log('MongoDB connected');     // Log success
  } catch (error) {
    console.error('MongoDB connection error:', error);  // Log error
    process.exit(1);                      // Exit on connection failure
  }
};

// Utility function to convert MongoDB document to Todo response
// Using any type for simplicity to avoid TypeScript complexity
const toTodoResponse = (doc: any): Todo => ({
  id: doc._id.toString(),  // Convert ObjectId to string
  text: doc.text,          // Copy text field
  priority: doc.priority,  // Copy priority field
  createdAt: doc.createdAt, // Copy timestamp
  displayId: doc.displayId  // Copy user-facing ID
});

// Export mongoose instance for referencing in other files
export const db = mongoose;

// Database operations object - contains all DB interaction functions
export const dbOperations = {
  // Add a new todo to the database
  addTodo: async (text: string, priority: 'high' | 'medium' | 'low' = 'medium'): Promise<Todo> => {
    // Create new Todo document
    const todo = new TodoModel({
      text,               // Set text from parameter
      priority,           // Set priority from parameter (defaults to 'medium')
      createdAt: new Date().toISOString()  // Set timestamp to now
    });
    
    await todo.save();    // Save to MongoDB
    return toTodoResponse(todo);  // Return formatted response
  },
  
  // Get all todos from the database
  getTodo: async (): Promise<Todo[]> => {
    // Use MongoDB aggregation to sort by priority first (high→medium→low) then by displayId
    const todos = await TodoModel.aggregate([
      {
        $addFields: {
          priorityOrder: {
            $switch: {
              branches: [
                { case: { $eq: ["$priority", "high"] }, then: 1 },   // high = 1
                { case: { $eq: ["$priority", "medium"] }, then: 2 }, // medium = 2
                { case: { $eq: ["$priority", "low"] }, then: 3 }     // low = 3
              ],
              default: 99  // Default value for unknown priorities
            }
          }
        }
      },
      { $sort: { priorityOrder: 1, displayId: 1 } }  // Sort by priority then by displayId
    ]);
    
    // Map all documents to response format
    return todos.map(todo => toTodoResponse(todo));
  },
  
  // Update the priority of a todo
  updatePriority: async (id: number, priority: 'high' | 'medium' | 'low'): Promise<boolean> => {
    // Find by displayId instead of MongoDB _id for compatibility
    const result = await TodoModel.findOneAndUpdate(
      { displayId: id },  // Query by displayId
      { priority }        // Update priority field
    );
    return !!result;      // Return true if found and updated, false otherwise
  },
  
  // Remove a todo by ID
  removeTodo: async (id: number): Promise<boolean> => {
    // Find and delete by displayId
    const result = await TodoModel.findOneAndDelete({ displayId: id });
    return !!result;      // Return true if found and deleted, false otherwise
  },
  
  // Get todos filtered by priority
  getTodosByPriority: async (priority: 'high' | 'medium' | 'low'): Promise<Todo[]> => {
    // Find todos with matching priority, sort by displayId ascending
    const todos = await TodoModel.find({ priority }).sort({ displayId: 1 });
    // Map to response format
    return todos.map(todo => toTodoResponse(todo));
  },
  
  // Reset displayIds for todos (create sequential IDs)
  resetTodoIds: async (sortByPriority: boolean = false): Promise<number> => {
    // Start a MongoDB session for transaction
    const session = await mongoose.startSession();
    session.startTransaction();  // Begin transaction for atomicity
    
    try {
      // Get all todos
      let todos: any[];
      
      if (sortByPriority) {
        // Custom priority order: high, medium, low
        // Use MongoDB aggregation for complex sorting
        todos = await TodoModel.aggregate([
          {
            // Add priorityOrder field for sorting
            $addFields: {
              priorityOrder: {
                $switch: {
                  branches: [
                    { case: { $eq: ["$priority", "high"] }, then: 1 },   // high = 1
                    { case: { $eq: ["$priority", "medium"] }, then: 2 }, // medium = 2
                    { case: { $eq: ["$priority", "low"] }, then: 3 }     // low = 3
                  ],
                  default: 99  // Default value for unknown priorities
                }
              }
            }
          },
          { $sort: { priorityOrder: 1, createdAt: 1 } }  // Sort by priority then creation date
        ]).session(session);
      } else {
        // Simple sort by creation date if not sorting by priority
        todos = await TodoModel.find().sort({ createdAt: 1 }).session(session);
      }
      
      // Update each todo with new sequential displayId
      for (let i = 0; i < todos.length; i++) {
        await TodoModel.findByIdAndUpdate(
          todos[i]._id,        // Find by MongoDB _id
          { displayId: i + 1 }, // Set displayId to 1, 2, 3...
          { session }          // Use same session for transaction
        );
      }
      
      await session.commitTransaction();  // Commit all changes
      return todos.length;                // Return number of updated todos
    } catch (error) {
      await session.abortTransaction();   // Roll back on error
      console.error('Error resetting todo IDs:', error);
      throw error;                        // Re-throw for caller handling
    } finally {
      session.endSession();               // Clean up session
    }
  }
};