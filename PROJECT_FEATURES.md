# RARO - Premium E-commerce Platform

RARO is a sophisticated, full-stack E-commerce solution designed for a premium shopping experience. Built with a robust Node.js backend and a dynamic EJS frontend, it features a complete set of tools for both customers and administrators.

---

## 🚀 Key Features

### 🛒 User Experience (Customer Side)

#### **1. Secure Authentication & Security**
- **Flexible Login**: Support for traditional Email/Password and one-click **Google OAuth** integration.
- **OTP Verification**: Multi-factor security via Email OTP for registration, password recovery, and sensitive profile updates.
- **Forgot Password**: Fully automated password reset workflow with secure token-based verification.

#### **2. Comprehensive Profile Management**
- **Intuitive Dashboard**: A centralized hub for users to track orders, manage wallet balance, and update details.
- **Dynamic Address Book**: Manage multiple shipping addresses with a user-friendly interface to set defaults.
- **Wallet System**: Integrated wallet for instant refunds, referral earnings, and seamless "one-tap" payments.
- **Referral Rewards**: A built-in referral system where users can invite friends and earn rewards.
- **Security Control**: Capability to change account email with secure OTP verification.

#### **3. Advanced Product Discovery**
- **Modern Shop UI**: Real-time search, category filtering, and price range sorting.
- **Product Intelligence**: Detailed product views with variant selection (Size/Color), multi-image galleries, and technical highlights.
- **Review System**: User-generated ratings and reviews to build trust and social proof.
- **Wishlist**: Quick-save functionality for items to be purchased later.

#### **4. Professional Checkout & Payments**
- **Seamless Checkout**: Multi-step, mobile-responsive checkout flow with address validation.
- **Payment Versatility**:
  - **Cash on Delivery (COD)**
  - **Integrated Wallet Payments**
  - **Online Payment Integration** (Razorpay support).
- **Offer Engine**: Automated calculation of Product-specific and Category-specific offers, plus a manual Coupon application system.
- **Invoice Generation**: Professional, automated PDF invoice generation with branding and itemized breakdowns.

#### **5. Post-Purchase Lifecycle**
- **Order Tracking**: Real-time status updates for every order.
- **Flexible Cancellations**: Support for both full and partial order cancellations before shipment.
- **Easy Returns**: Streamlined return request process with automated wallet refunds upon admin approval.

---

### 🛠️ Administrative Control (Admin Side)

#### **1. Analytics & Business Intelligence**
- **Command Dashboard**: High-level overview of sales, user growth, and platform health.
- **Data-Driven Reporting**: Generate detailed sales reports with custom date range filters to track revenue and performance.

#### **2. Inventory & Catalog Management**
- **Advanced Product CRUD**: Effortless management of products with support for multi-image uploads.
- **Granular Variant Control**: Manage stock levels down to the specific size and color variant (e.g., XL - Blue: 10 units).
- **Category Hierarchy**: Organize products into logical categories with the ability to list/unlist them instantly.
- **Soft Deletion**: Securely manage deleted products and categories without losing historical data.

#### **3. Promotion & Offer Management**
- **Coupon Factory**: Create, list, and manage promotional coupons with expiry and usage limits.
- **Tiered Discounts**: Apply offers at both the individual product level and the broad category level.
- **Banner Control**: Manage promotional banners to drive traffic to specific sales or collections on the home page.

#### **4. Order & Return Governance**
- **Unified Order Dashboard**: Track and manage all customer orders from a single interface.
- **Status Automation**: Update fulfillment status from Pending to Delivered with automated customer notifications.
- **Return Resolution**: Dedicated interface to approve/reject return requests for specific items or entire orders.

#### **5. User & Security Oversight**
- **Customer Directory**: Search and manage the entire user base.
- **Access Management**: Instantly Block/Unblock users to maintain a safe platform environment.

---

## 💻 Technical Architecture

| Layer | Technology |
| :--- | :--- |
| **Runtime** | Node.js (v18+) |
| **Framework** | Express.js |
| **Database** | MongoDB with Mongoose ODM |
| **Frontend** | EJS (Template Engine), Vanilla CSS, Bootstrap |
| **Auth** | Passport.js (Local & Google strategies) |
| **Storage** | Multer for local/cloud image management |
| **Payments** | Razorpay & Integrated Wallet |
| **Email** | Nodemailer (for OTPs and Notifications) |
| **PDF** | EasyInvoice / Custom EJS for professional invoicing |

---

## 📂 Project Structure Highlights
- `controllers/`: Clean separation of logic for Admin and User routes.
- `services/`: Encapsulated business logic for better testability and reuse.
- `models/`: Strictly typed Mongoose schemas for data integrity.
- `middlewares/`: Robust authentication and validation guards.
