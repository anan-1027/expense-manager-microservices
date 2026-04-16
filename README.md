# Personal Expense Manager (Microservices Architecture)

## Overview
This project is a microservices-based expense management system designed to manage user expenses efficiently using a modular and scalable architecture.

The system separates functionalities into independent services, improving maintainability and scalability.

---

## Architecture
The application is built using multiple microservices:

- User Service – handles user-related operations  
- Expense Service – manages expense transactions  
- Category Service – handles expense categories  
- Budget Service – manages budget limits  
- Report Service – generates analytical reports  

An API Gateway (Nginx) routes incoming requests to the appropriate service.

Services communicate using REST APIs and gRPC, and asynchronous communication is handled through a message queue (ActiveMQ).

---

## Tech Stack
- Backend: Node.js / Express  
- Communication: REST APIs, gRPC  
- Databases: MongoDB, MySQL  
- Message Broker: ActiveMQ  
- Containerization: Docker, Docker Compose  
- Frontend: HTML, CSS, JavaScript  

---

## Features
- User management  
- Expense tracking  
- Category management  
- Budget planning  
- Report generation  

---

## Running the Project

1. Install Docker  
2. Extract the project  
3. Open terminal inside the project folder  

Run:

```bash
docker-compose up --build
