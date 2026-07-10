/* ===========================
   CFEE — cart.js  (shared across all pages)
   =========================== */

// ---------- Cart State ----------
let cart = JSON.parse(localStorage.getItem('cfee_cart') || '[]');

function saveCart() {
  localStorage.setItem('cfee_cart', JSON.stringify(cart));
}

function getTotal() {
  return cart.reduce((sum, i) => sum + i.price * i.qty, 0);
}

function getCount() {
  return cart.reduce((sum, i) => sum + i.qty, 0);
}

// ---------- Update Cart UI ----------
function updateCartUI() {
  const countEl = document.getElementById('cart-count');
  if (countEl) countEl.textContent = getCount();

  const itemsEl = document.getElementById('cart-items');
  if (!itemsEl) return;

  if (cart.length === 0) {
    itemsEl.innerHTML = `
      <div class="cart-empty">
        <div class="empty-icon">☕</div>
        <p>Your cart is empty</p>
        <p style="font-size:0.82rem;margin-top:0.4rem">Add some delicious items!</p>
      </div>`;
  } else {
    itemsEl.innerHTML = cart.map((item, idx) => `
      <div class="cart-item">
        <div class="cart-item-emoji">${item.emoji}</div>
        <div class="cart-item-info">
          <h4>${item.name}</h4>
          <span class="item-price">₹${(item.price * item.qty)}</span>
        </div>
        <div class="cart-item-qty">
          <button class="qty-btn" onclick="changeQty(${idx}, -1)">−</button>
          <span class="qty-num">${item.qty}</span>
          <button class="qty-btn" onclick="changeQty(${idx}, 1)">+</button>
        </div>
        <button class="remove-btn" onclick="removeItem(${idx})">🗑</button>
      </div>`).join('');
  }

  const total = getTotal();
  const tax = Math.round(total * 0.05);
  const grand = total + tax + 30; // delivery ₹30

  const subEl = document.getElementById('cart-subtotal-val');
  const taxEl = document.getElementById('cart-tax-val');
  const totEl = document.getElementById('cart-total-val');
  if (subEl) subEl.textContent = `₹${total}`;
  if (taxEl) taxEl.textContent = `₹${tax}`;
  if (totEl) totEl.textContent = `₹${grand}`;
}

function changeQty(idx, delta) {
  cart[idx].qty += delta;
  if (cart[idx].qty < 1) cart.splice(idx, 1);
  saveCart();
  updateCartUI();
}

function removeItem(idx) {
  cart.splice(idx, 1);
  saveCart();
  updateCartUI();
  showToast('Item removed from cart');
}

// ---------- Add to Cart ----------
function addToCart(name, price, emoji, category) {
  const existing = cart.find(i => i.name === name);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ name, price, emoji, category, qty: 1 });
  }
  saveCart();
  updateCartUI();
  showToast(`${emoji} ${name} added to cart!`);
}

// ---------- Cart Sidebar ----------
function openCart() {
  document.getElementById('cart-overlay').classList.add('open');
  document.getElementById('cart-sidebar').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeCart() {
  document.getElementById('cart-overlay').classList.remove('open');
  document.getElementById('cart-sidebar').classList.remove('open');
  document.body.style.overflow = '';
}

// ---------- Payment Modal ----------
function openPayment() {
  if (cart.length === 0) { showToast('Your cart is empty!'); return; }
  updateOrderSummary();
  document.getElementById('payment-modal').classList.add('open');
  document.body.style.overflow = 'hidden';
  showPaymentStep('delivery');
}

function closePayment() {
  document.getElementById('payment-modal').classList.remove('open');
  document.body.style.overflow = '';
}

function showPaymentStep(step) {
  document.querySelectorAll('.payment-step').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.step-btn').forEach(b => b.classList.remove('active'));
  const el = document.getElementById('step-' + step);
  const btn = document.querySelector(`[data-step="${step}"]`);
  if (el) el.classList.add('active');
  if (btn) btn.classList.add('active');
}

function updateOrderSummary() {
  const container = document.getElementById('order-lines');
  if (!container) return;
  const total = getTotal();
  const tax = Math.round(total * 0.05);
  const grand = total + tax + 30;
  container.innerHTML = cart.map(i => `
    <div class="order-line"><span>${i.name} ×${i.qty}</span><span>₹${i.price * i.qty}</span></div>
  `).join('') + `
    <div class="order-line"><span>Delivery</span><span>₹30</span></div>
    <div class="order-line"><span>GST (5%)</span><span>₹${tax}</span></div>
    <div class="order-line total"><span>Total</span><span>₹${grand}</span></div>`;

  const payTotalEl = document.getElementById('pay-total');
  if (payTotalEl) payTotalEl.textContent = `₹${grand}`;
}

function selectPaymentMethod(method) {
  document.querySelectorAll('.pm-option').forEach(o => o.classList.remove('selected'));
  document.querySelector(`[data-method="${method}"]`)?.classList.add('selected');

  document.querySelectorAll('.card-fields, .upi-field, .cod-field, .wallet-field').forEach(f => {
    f.style.display = 'none';
  });

  const target = document.getElementById(`fields-${method}`);
  if (target) target.style.display = 'block';
}

async function placeOrder() {

  const selected = document.querySelector('.pm-option.selected');

  if (!selected) {
    showToast("Please select a payment method");
    return;
  }

  const total = getTotal();
  const tax = Math.round(total * 0.05);
  const grand = total + tax + 30;

  const btn = document.getElementById("place-order-btn");

  btn.disabled = true;
  btn.textContent = "Creating Order...";

  try {

    const response = await fetch("/api/create-order", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        amount: grand
      })
    });

    const order = await response.json();

    const options = {

      key: "YOUR_RAZORPAY_TEST_KEY_ID",

      amount: order.amount,

      currency: order.currency,

      name: "CFEE Coffee",

      description: "Coffee Order",

      order_id: order.id,

      handler: async function (response) {

        const verify = await fetch("/api/verify-payment", {

          method: "POST",

          headers: {
            "Content-Type": "application/json"
          },

          body: JSON.stringify(response)

        });

        const result = await verify.json();

        if (result.success) {

          document.getElementById("order-id-display").textContent =
            `Order #${response.razorpay_order_id}`;

          cart = [];

          saveCart();

          updateCartUI();

          showPaymentStep("success");

        } else {

          showToast("Payment verification failed");

        }

      },

      prefill: {

        name: "",

        email: "",

        contact: ""

      },

      theme: {

        color: "#7b4a2e"

      }

    };

    const rzp = new Razorpay(options);

    rzp.open();

    btn.disabled = false;
    btn.textContent = "Place Order";

  } catch (err) {

    console.error(err);

    showToast("Unable to create payment");

    btn.disabled = false;

    btn.textContent = "Place Order";

  }

}

// ---------- Toast ----------
function showToast(msg) {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.className = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}

// ---------- Navbar Hamburger ----------
function initNav() {
  const ham = document.querySelector('.hamburger');
  const links = document.querySelector('.nav-links');
  const cartBtnNav = document.querySelector('.cart-btn');

  if (ham && links) {
    ham.addEventListener('click', () => {
      links.classList.toggle('open');
      if (cartBtnNav) {
        cartBtnNav.style.display = links.classList.contains('open') ? 'block' : '';
      }
    });
  }

  // Active link
  const current = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a').forEach(a => {
    if (a.getAttribute('href') === current) a.classList.add('active');
  });
}

// ---------- Menu Filter ----------
function initMenuFilter() {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const cat = btn.dataset.category;
      document.querySelectorAll('.menu-card').forEach(card => {
        card.style.display = (cat === 'all' || card.dataset.category === cat) ? '' : 'none';
      });
    });
  });
}

// ---------- Init ----------
document.addEventListener('DOMContentLoaded', () => {
  initNav();
  initMenuFilter();
  updateCartUI();

  // Cart open/close
  document.getElementById('cart-overlay')?.addEventListener('click', closeCart);
});
