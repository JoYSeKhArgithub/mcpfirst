import {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js"
import {StdioServerTransport} from "@modelcontextprotocol/sdk/server/stdio.js"
import {z} from "zod"
import { db, dbOperations, connectDB, Todo } from "./database.js";

// Create and start MCP Server in a main async function
async function main() {
  // Connect to MongoDB first before starting server
  await connectDB();

  // Initialize MCP server with name and version
  const server = new McpServer({
    name: "Todo",
    version: "1.0.0"
  });

  // Tool to update the priority of a todo item
  server.tool(
    "update-todo-priority",  // Tool name
    {
      // Input schema validation with Zod
      id: z.number(),        // ID must be a number
      priority: z.enum(['high','medium','low'])  // Priority must be one of these values
    },
    async ({id, priority}) => {  // Async handler function
      // Call DB operation to update priority
      const success = await dbOperations.updatePriority(id, priority);

      // Return appropriate response based on success
      if(!success){
        return{
          content: [
            {
              type: "text",
              text: `Failed to update priority for todo item ${id}`,
            }
          ]
        }
      }
      return{
        content: [
          {
            type: "text",
            text: `Successfully updated priority for todo item ${id} to ${priority}`,
          }
        ]
      }
    }
  );

  // Tool to add a new todo
  server.tool(
    "add-todo",
    {
      text: z.string(),   // Text must be a string
      priority: z.enum(['high','medium','low']).optional()  // Optional priority
    },
    async ({text, priority='medium'}) => {  // Default priority to medium
      // Add todo to database
      const todo = await dbOperations.addTodo(text, priority);
      
      // Use displayId if available, otherwise fallback to MongoDB _id
      const idToShow = todo.displayId || todo.id;
      
      // Return success response
      return {
        content: [
          {
            type: "text",
            text: `${text} was added to our todo with ID ${idToShow} (Priority: ${priority})`,
          }
        ]
      };
    }
  );

  // Tool to get all todos
  server.tool(
    "get-todo",
    {},  // No parameters needed
    async () => {
      // Get all todos from database
      const todos = await dbOperations.getTodo();

      // Handle case of no todos
      if(todos.length === 0){
        return {
          content: [
            {
              type: "text",
              text: `You have no Todo items yet`,
            }
          ] 
        }
      }

      // Format todos as a string list
      const todoList = todos.map(todo => 
        `${todo.displayId || todo.id}: [${todo.priority.toUpperCase()}] ${todo.text}`
      ).join("\n");

      // Return formatted list
      return {
        content: [
          {
            type: "text",
            text: `You have ${todos.length} to do items: \n ${todoList}`,
          }
        ]
      }
    }
  );

  // Tool to remove a todo
  server.tool(
    "remove-todo",
    {
      id: z.number()  // ID must be a number
    },
    async ({id}) => {
      // Remove todo from database
      const success = await dbOperations.removeTodo(id);

      // Handle case where todo wasn't found
      if(!success){
        return {
          content: [
            {
              type: "text",
              text: `No Todo item found with todo id: ${id} `,
            }
          ]                
        }
      }

      // Return success message
      return {
        content: [
          {
            type: "text",
            text: `Todo ${id} was deleted successfully`,
          }
        ]
      }
    }
  );

  // Tool to get todos filtered by priority
  server.tool(
    "get-todos-by-priority",
    {
      priority: z.enum(['high','medium','low'])  // Priority must be valid value
    },
    async ({priority}) => {
      // Get todos with specified priority
      const todos = await dbOperations.getTodosByPriority(priority);

      // Handle case of no matching todos
      if(todos.length === 0){
        return {
          content: [
            {
              type: "text",
              text: `You have no ${priority} priority todo items`,
            }
          ] 
        }
      }

      // Return formatted list
      return {
        content: [
          {
            type: "text",
            text: `You have ${todos.length} ${priority} priority todo items:\n` + 
              todos.map(todo => `${todo.displayId || todo.id}: [${todo.priority.toUpperCase()}] ${todo.text}`).join("\n")
          }
        ]
      }
    }
  );

  // Tool to reset todo IDs (make them sequential)
  server.tool(
    "reset-todo-ids",
    {
      sortByPriority: z.boolean().optional()  // Optional parameter to sort by priority
    },
    async ({sortByPriority = false}) => {
      // Reset IDs in database
      const todoCount = await dbOperations.resetTodoIds(sortByPriority);

      // Add message about sorting if applicable
      const sortMessage = sortByPriority ? 
        " (sorted by priority)" : "";

      // Return success message
      return {
        content: [
          {
            type: "text",
            text: `Successfully reset IDs for ${todoCount} todo items${sortMessage}.`,
          }
        ]
      }
    }
  );

  // Start server with transport mechanism
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// Call main function and handle errors
main().catch((error) => {
  console.log(error);
  process.exit(1);
});