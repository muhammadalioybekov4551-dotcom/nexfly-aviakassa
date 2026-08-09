// Vercel Serverless Function
// Bu server tomonidan ishlaydi, shuning uchun CORS cheklovi yo'q.
// Frontend shu manzilga so'rov yuboradi: /api/prices?origin=TAS&destination=IST&departure_at=2026-08-20

const TP_TOKEN = "635411d6a00a0df3158645f4bd9f546b";

export default async function handler(req, res) {
  const { origin, destination, departure_at } = req.query;

  if (!origin || !destination || !departure_at) {
    return res.status(400).json({ success: false, error: "origin, destination, departure_at kerak" });
  }

  const url = `https://api.travelpayouts.com/aviasales/v3/prices_for_dates?origin=${origin}&destination=${destination}&departure_at=${departure_at}&one_way=true&direct=false&currency=usd&sorting=price&limit=15&token=${TP_TOKEN}`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate");
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ success: false, error: "API so'rovi muvaffaqiyatsiz: " + err.message });
  }
}
