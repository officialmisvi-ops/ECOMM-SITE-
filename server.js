import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(cors());
app.use(express.json());

// Serve static assets from public folder
app.use(express.static(path.resolve(__dirname, 'public')));
if (fs.existsSync(path.resolve(__dirname, 'dist'))) {
  app.use(express.static(path.resolve(__dirname, 'dist')));
}

// Load 88 MISVI catalog products
const productsPath = path.resolve(__dirname, 'src/data/products.json');
let products = [];
try {
  products = JSON.parse(fs.readFileSync(productsPath, 'utf-8'));
  console.log(`[MISVI Node Server] Loaded ${products.length} products.`);
} catch (err) {
  console.error('[MISVI Node Server] Error loading products:', err);
}

// -------------------------------------------------------------
// 1. Product Catalog API
// -------------------------------------------------------------
app.get('/api/products', (req, res) => {
  res.json({
    success: true,
    count: products.length,
    products,
  });
});

app.get('/api/products/:id', (req, res) => {
  const product = products.find((p) => p.id === req.params.id || p.sku === req.params.id);
  if (!product) {
    return res.status(404).json({ success: false, error: 'Product not found' });
  }
  res.json({ success: true, product });
});

// -------------------------------------------------------------
// 2. Cashfree Payment Gateway: Create Order
// -------------------------------------------------------------
app.post('/api/create-order', async (req, res) => {
  try {
    const {
      orderAmount,
      customerName,
      customerPhone,
      customerEmail,
      address,
      city,
      state,
      pincode,
      items,
    } = req.body;

    if (!orderAmount || isNaN(orderAmount) || orderAmount <= 0) {
      return res.status(400).json({ success: false, error: 'Valid order amount is required' });
    }

    if (!customerName || !customerPhone) {
      return res.status(400).json({ success: false, error: 'Customer name and phone number are required' });
    }

    const cleanPhone = String(customerPhone).replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      return res.status(400).json({ success: false, error: 'Please enter a valid 10-digit mobile number' });
    }

    const orderId = `MISVI_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const sanitizedEmail = customerEmail && customerEmail.includes('@')
      ? customerEmail.trim()
      : `guest_${cleanPhone.slice(-4)}@misvitoys.com`;

    const appId = process.env.CASHFREE_APP_ID;
    const secretKey = process.env.CASHFREE_SECRET_KEY;
    const env = (process.env.CASHFREE_ENV || 'TEST').toUpperCase();
    const isProd = env === 'PROD' || env === 'PRODUCTION';
    const baseUrl = isProd ? 'https://api.cashfree.com/pg' : 'https://sandbox.cashfree.com/pg';
    const appUrl = process.env.APP_URL || `http://localhost:${PORT}`;

    const hasLiveKeys = appId && secretKey && !appId.includes('your_') && !secretKey.includes('your_');

    if (hasLiveKeys) {
      try {
        const cashfreePayload = {
          order_id: orderId,
          order_amount: Number(Number(orderAmount).toFixed(2)),
          order_currency: 'INR',
          customer_details: {
            customer_id: `CUST_${cleanPhone.slice(-10)}`,
            customer_name: customerName.trim(),
            customer_email: sanitizedEmail,
            customer_phone: cleanPhone.slice(-10),
          },
          order_meta: {
            return_url: `${appUrl}/order-status?order_id={order_id}`,
            notify_url: `${appUrl}/api/cashfree-webhook`,
          },
          order_note: `MISVI Toys Order - ${items?.length || 1} items (${address || ''}, ${city || ''} ${pincode || ''})`,
        };

        const response = await fetch(`${baseUrl}/orders`, {
          method: 'POST',
          headers: {
            'x-client-id': appId,
            'x-client-secret': secretKey,
            'x-api-version': '2023-08-01',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(cashfreePayload),
        });

        const data = await response.json();

        if (response.ok && data.payment_session_id) {
          return res.json({
            success: true,
            orderId: data.order_id,
            paymentSessionId: data.payment_session_id,
            cfEnvironment: isProd ? 'production' : 'sandbox',
            orderAmount,
            mode: 'live',
          });
        } else {
          return res.json({
            success: true,
            orderId,
            paymentSessionId: `session_sim_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            cfEnvironment: 'sandbox',
            orderAmount,
            mode: 'simulated',
            note: data.message || 'Cashfree test mode active',
          });
        }
      } catch (fetchErr) {
        return res.json({
          success: true,
          orderId,
          paymentSessionId: `session_sim_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          cfEnvironment: 'sandbox',
          orderAmount,
          mode: 'simulated',
          note: 'Network fallback simulated session',
        });
      }
    } else {
      return res.json({
        success: true,
        orderId,
        paymentSessionId: `session_sandbox_demo_${Date.now()}`,
        cfEnvironment: 'sandbox',
        orderAmount,
        mode: 'simulated',
        note: 'Running in simulated Cashfree test environment. Add your Cashfree App ID & Secret in .env for live gateway.',
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
});

// -------------------------------------------------------------
// 3. Cashfree Order Verification
// -------------------------------------------------------------
app.get('/api/verify-order/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const appId = process.env.CASHFREE_APP_ID;
    const secretKey = process.env.CASHFREE_SECRET_KEY;
    const env = (process.env.CASHFREE_ENV || 'TEST').toUpperCase();
    const isProd = env === 'PROD' || env === 'PRODUCTION';
    const baseUrl = isProd ? 'https://api.cashfree.com/pg' : 'https://sandbox.cashfree.com/pg';

    const hasLiveKeys = appId && secretKey && !appId.includes('your_') && !secretKey.includes('your_');

    if (hasLiveKeys && !orderId.startsWith('session_sim') && !orderId.includes('demo')) {
      const response = await fetch(`${baseUrl}/orders/${orderId}`, {
        headers: {
          'x-client-id': appId,
          'x-client-secret': secretKey,
          'x-api-version': '2023-08-01',
        },
      });
      const data = await response.json();
      return res.json({ success: true, order: data });
    }

    res.json({
      success: true,
      order: {
        order_id: orderId,
        order_status: 'PAID',
        payment_method: 'Cashfree Web Checkout',
        currency: 'INR',
        created_at: new Date().toISOString(),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// 4. In-Store Gemini AI Assistant ("Ask Misvi AI")
// -------------------------------------------------------------
app.post('/api/ai-advisor', async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ success: false, error: 'Query message is required' });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    const catalogSummary = products.map((p) => ({
      id: p.id,
      title: p.title,
      category: p.category,
      price: p.price,
      mrp: p.mrp,
      age: p.ageText,
      highlights: p.bulletFeatures?.slice(0, 2).join('; '),
    }));

    if (apiKey && !apiKey.includes('MY_GEMINI_API_KEY') && apiKey.trim().length > 10) {
      try {
        const ai = new GoogleGenAI();
        const systemPrompt = `You are "Misvi AI", the expert toy shopping assistant for MISVI Toys (https://misvitoys.com).
MISVI creates screen-free, BPA-free, BIS-certified toys for kids (ages 0 to 12).
Free shipping across India on orders above ₹499.

Catalog:
${JSON.stringify(catalogSummary)}

Guidelines:
1. Recommend top 2-3 specific toys matching the user query (age, price under ₹X, musical, learning, puzzle, motor skills).
2. Include Exact Title, Selling Price (e.g. ₹399), MRP, Age, and developmental benefits.
3. Warm, helpful, concise tone with bullet points. Always use the Indian Rupee symbol (₹).`;

        const geminiPromise = ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: [
            {
              role: 'user',
              parts: [{ text: `${systemPrompt}\n\nCustomer question: "${message}"` }],
            },
          ],
        });

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Gemini API timeout')), 5000)
        );

        const response = await Promise.race([geminiPromise, timeoutPromise]);
        const reply = response.text || 'Check out our top recommended educational and musical toys!';
        const suggestedProducts = products.filter((p) =>
          reply.toLowerCase().includes(p.title.toLowerCase().slice(0, 25))
        ).slice(0, 3);

        return res.json({
          success: true,
          reply,
          suggestedProducts: suggestedProducts.length > 0 ? suggestedProducts : products.slice(0, 3),
        });
      } catch (geminiError) {
        console.warn('[MISVI Gemini Node API Warning]', geminiError.message);
      }
    }

    // Fallback recommendation
    const lower = message.toLowerCase();
    let matches = products.filter((p) => {
      const text = `${p.title} ${p.category} ${p.description}`.toLowerCase();
      if (lower.includes('music') || lower.includes('sound') || lower.includes('sing') || lower.includes('piano')) {
        return p.category === 'Musical Toys';
      }
      if (lower.includes('puzzle') || lower.includes('jigsaw') || lower.includes('brain')) {
        return p.category === 'Puzzles';
      }
      if (lower.includes('sensory') || lower.includes('baby') || lower.includes('toddler')) {
        return p.category === 'Sensory & Activity' || p.minAge <= 1;
      }
      return text.includes('montessori') || text.includes('learning');
    });

    if (matches.length === 0) matches = products.slice(0, 3);
    const topPicks = matches.slice(0, 3);

    const fallbackReply = `Here are my top recommendations for you from MISVI:
${topPicks
  .map(
    (p, i) =>
      `\n${i + 1}. **${p.title}** (${p.ageText})
   - **Special Price:** ₹${p.price} ~~(MRP ₹${p.mrp})~~
   - **Key Benefit:** ${p.bulletFeatures[0]}
   - **Why kids love it:** ${p.description.slice(0, 110)}...`
  )
  .join('\n')}

All MISVI orders above ₹499 qualify for Free Express Shipping across India!`;

    res.json({
      success: true,
      reply: fallbackReply,
      suggestedProducts: topPicks,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || 'AI advisor service error' });
  }
});

// Fallback to public/index.html
app.get('*', (req, res) => {
  res.sendFile(path.resolve(__dirname, 'public/index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[MISVI Node Server] Listening on http://0.0.0.0:${PORT}`);
});
