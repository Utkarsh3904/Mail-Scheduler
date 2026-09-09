import axios from "axios";

const ES_URL = process.env.ELASTIC_NODE || "http://localhost:9200";
const ES_API_KEY = process.env.ELASTIC_API_KEY;

const headers = ES_API_KEY
  ? { Authorization: `ApiKey ${ES_API_KEY}` }
  : {};

const INDEX = "emails";

export async function setupIndex() {
  try {
    await axios.head(`${ES_URL}/${INDEX}`, { headers });
  } catch (err: any) {
    if (err.response && err.response.status === 404) {
      await axios.put(
        `${ES_URL}/${INDEX}`,
        {
          mappings: {
            properties: {
              userId: { type: "integer" },
              recipient: { type: "text" },
              subject: { type: "text" },
              body: { type: "text" },
              sender: { type: "keyword" },
              status: { type: "keyword" },
              scheduledTime: { type: "date" },
              sentTime: { type: "date" },
            },
          },
        },
        { headers }
      );
      console.log("created elasticsearch index");
    } else {
      console.log("elasticsearch not reachable yet:", err.message);
    }
  }
}

export async function indexEmail(id: number, doc: any) {
  try {
    await axios.put(`${ES_URL}/${INDEX}/_doc/${id}`, doc, { headers });
  } catch (err: any) {
    console.log("failed to index email", id, err.message);
  }
}

export async function searchEmails(userId: number, q: string) {
  const body: any = {
    query: {
      bool: {
        must: [{ term: { userId } }],
      },
    },
    sort: [{ scheduledTime: "desc" }],
    size: 100,
  };

  if (q) {
    body.query.bool.must.push({
      multi_match: { query: q, fields: ["subject", "body", "recipient"] },
    });
  }

  const res = await axios.post(`${ES_URL}/${INDEX}/_search`, body, { headers });
  return res.data.hits.hits.map((h: any) => h._source);
}