const { MongoClient } = require("mongodb");
async function main() {
  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017";
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db("payme");
  const workspaces = await db.collection("workspaces").find({}).toArray();
  console.log("Workspaces:", workspaces.map(w => w.name));
  await client.close();
}
main().catch(console.error);
