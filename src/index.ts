import { Elysia } from "elysia";
import { swagger } from "@elysiajs/swagger";
import {
  CardsCapitals,
  LearningsRecord,
  Sets,
  SetsRecord,
  UserSets,
  getXataClient,
} from "./xata";

const app = new Elysia();
const client = getXataClient();

app.use(
  swagger({
    autoDarkMode: false,
    documentation: {
      tags: [{ name: "General", description: "General endpoints" }],
      info: {
        title: "Learning app Documentation",
        version: "1.0.0",
      },
    },
  })
);

app.get("/", () => "Hello Elysia", {
  detail: {
    tags: ["General"],
  },
});

app.get("/sets", async ({ set }) => {
  const sets = await client.db.sets
    .select(["id", "title", "description", "cards"])
    .filter({ private: false })
    .getAll();
  set.status = 200;
  return sets;
});
app.post("/sets", async ({ body }) => {
  const { title, description, private: isPrivate, creator } = body as Sets;

  const set = await client.db.sets.create({
    title,
    description,
    private: isPrivate,
    creator,
  });

  return set;
});

// Get a single set
app.get("/sets/:id", async ({ params }) => {
  const { id } = params;
  const set = await client.db.sets.read(id);
  return set;
});
// Remove a set
app.delete("/sets/:id", async ({ params }) => {
  const { id } = params;
  const existingSets = await client.db.user_sets.filter({ set: id }).getAll();

  if (existingSets.length > 0) {
    const toDelete = existingSets.map((set: SetsRecord) => set.id);
    await client.db.user_sets.delete(toDelete);
  }
  await client.db.sets.delete(id);

  return { success: true };
});

// Add a set to user favorites
app.post("/usersets", async ({ body }) => {
  const { user, set } = body as UserSets;
  const userSet = await client.db.user_sets.create({
    user,
    set,
  });
  return userSet;
});

// Get all user sets
app.get("/usersets", async ({ query }) => {
  const { user } = query;

  const sets = await client.db.user_sets
    .select(["id", "set.*"])
    .filter({ user: `${user}` })
    .getAll();
  return sets;
});

// Create a new card
app.post("/cards", async ({ body }) => {
  const { set, question, answer } = body as CardsCapitals;
  const card = await client.db.cardsCapitals.create({
    set,
    question,
    answer,
  });

  if (card) {
    await client.db.sets.update(set!, {
      cards: {
        $increment: 1,
      },
    });
  }
  return card;
});

// Get all cards of a set
app.get("/cards/:setid", async ({ params }) => {
  const { setid } = params;
  const cards = await client.db.cardsCapitals
    .select(["*", "set"])
    .filter({ set: setid })
    .getAll();
  return cards;
});

// Learn a specific number of cards from a set
app.get("/cards/learn", async ({ query }) => {
  const { setid, limit } = query;

  const cards = await client.db.cardsCapitals
    .select(["question", "answer"])
    .filter({ set: setid })
    .getAll();

  // Get a random set of cards using limit
  const randomCards = cards
    .map((value) => ({ value, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ value }) => value)
    .slice(0, +limit!);

  return randomCards;
});

// Start learning progress
app.post("/learnings", async ({ body }) => {
  const { user, set, cards_total, cards_correct, cards_wrong } =
    body as LearningsRecord;
  const obj = {
    user,
    set,
    cards_total: +cards_total!,
    cards_correct: +cards_correct!,
    cards_wrong: +cards_wrong!,
    score: (+cards_correct! / +cards_total!) * 100,
  };
  const learning = await client.db.learnings.create(obj);
  return learning;
});

// Get user learning progress
app.get("/learnings", async ({ query }) => {
  const { user } = query;
  const learnings = await client.db.learnings
    .select(["*", "set.*"])
    .filter({ user: `${user}` })
    .getAll();
  return learnings;
});

try {
  app.listen(process.env.PORT || 4000);

  console.log(
    `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
  );
} catch (error) {
  console.log(error);
}
