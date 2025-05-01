import mongoose, { Document, Schema } from 'mongoose';

// Interface for Todo document - defines the structure a Todo document must have
// Extends mongoose's Document interface to add MongoDB document functionality
export interface ITodo extends Document {
  text: string;                        // The content of the todo item
  priority: 'high' | 'medium' | 'low'; // Priority level with specific allowed values 
  createdAt: string;                   // Timestamp when the todo was created
  displayId?: number;                  // Optional user-friendly sequential ID (? makes it optional)
}

// Create Mongoose schema for Todo items
// Schema defines the structure, validation rules, and defaults for MongoDB documents
const todoSchema = new Schema<ITodo>({
  text: {
    type: String,         // Text field is a string
    required: true        // Text is required and can't be null/undefined
  },
  priority: {
    type: String,         // Priority is a string
    enum: ['high', 'medium', 'low'],  // Only these 3 values are valid
    default: 'medium'     // If not specified, defaults to 'medium'
  },
  createdAt: {
    type: String,         // Store timestamp as string
    default: () => new Date().toISOString()  // Default to current time if not provided
  },
  displayId: {
    type: Number,         // User-friendly ID is a number
    sparse: true          // Sparse index allows null/undefined values
  }
});

// Create and export the model
// Models provide an interface to the database for CRUD operations
export const TodoModel = mongoose.model<ITodo>('Todo', todoSchema); 