-- CreateTable
CREATE TABLE "Envelope" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "percentage" REAL NOT NULL
);

-- CreateTable
CREATE TABLE "MonthlyBudget" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "month" TEXT NOT NULL,
    "income" REAL NOT NULL
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date" DATETIME NOT NULL,
    "description" TEXT NOT NULL,
    "value" REAL NOT NULL,
    "type" TEXT NOT NULL,
    "envelopeId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Transaction_envelopeId_fkey" FOREIGN KEY ("envelopeId") REFERENCES "Envelope" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyBudget_month_key" ON "MonthlyBudget"("month");
