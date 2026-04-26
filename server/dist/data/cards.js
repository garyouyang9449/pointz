export const cards = [
    {
        id: "amex-gold",
        issuer: "American Express",
        name: "American Express Gold Card",
        network: "amex",
        annualFee: 325,
        rewardRules: [
            { category: "dining", rate: 4, rewardType: "points", notes: "4x at restaurants worldwide." },
            { category: "groceries", rate: 4, rewardType: "points", cap: { amount: 25000, period: "year" }, notes: "4x at US supermarkets up to the annual cap." },
            { category: "travel", rate: 3, rewardType: "points", notes: "3x on flights booked directly or through Amex Travel." },
            { category: "general", rate: 1, rewardType: "points" }
        ]
    },
    {
        id: "chase-sapphire-preferred",
        issuer: "Chase",
        name: "Chase Sapphire Preferred",
        network: "visa",
        annualFee: 95,
        rewardRules: [
            { category: "dining", rate: 3, rewardType: "points" },
            { category: "streaming", rate: 3, rewardType: "points" },
            { category: "groceries", rate: 3, rewardType: "points", notes: "Online grocery purchases, excluding superstores." },
            { category: "travel", rate: 2, rewardType: "points" },
            { category: "transit", rate: 2, rewardType: "points" },
            { category: "general", rate: 1, rewardType: "points" }
        ]
    },
    {
        id: "chase-sapphire-reserve",
        issuer: "Chase",
        name: "Chase Sapphire Reserve",
        network: "visa",
        annualFee: 550,
        rewardRules: [
            { category: "dining", rate: 3, rewardType: "points" },
            { category: "travel", rate: 3, rewardType: "points" },
            { category: "transit", rate: 3, rewardType: "points" },
            { category: "general", rate: 1, rewardType: "points" }
        ]
    },
    {
        id: "chase-freedom-unlimited",
        issuer: "Chase",
        name: "Chase Freedom Unlimited",
        network: "visa",
        annualFee: 0,
        rewardRules: [
            { category: "dining", rate: 3, rewardType: "cashback_percent" },
            { category: "drugstores", rate: 3, rewardType: "cashback_percent" },
            { category: "travel", rate: 5, rewardType: "cashback_percent", notes: "Travel booked through Chase Travel." },
            { category: "general", rate: 1.5, rewardType: "cashback_percent" }
        ]
    },
    {
        id: "chase-freedom-flex",
        issuer: "Chase",
        name: "Chase Freedom Flex",
        network: "mastercard",
        annualFee: 0,
        rewardRules: [
            { category: "dining", rate: 3, rewardType: "cashback_percent" },
            { category: "drugstores", rate: 3, rewardType: "cashback_percent" },
            { category: "travel", rate: 5, rewardType: "cashback_percent", notes: "Travel booked through Chase Travel." },
            { category: "general", rate: 1, rewardType: "cashback_percent" }
        ]
    },
    {
        id: "citi-double-cash",
        issuer: "Citi",
        name: "Citi Double Cash",
        network: "mastercard",
        annualFee: 0,
        rewardRules: [{ category: "general", rate: 2, rewardType: "cashback_percent", notes: "1% when you buy plus 1% when you pay." }]
    },
    {
        id: "citi-custom-cash",
        issuer: "Citi",
        name: "Citi Custom Cash",
        network: "mastercard",
        annualFee: 0,
        rewardRules: [
            { category: "dining", rate: 5, rewardType: "cashback_percent", cap: { amount: 500, period: "month" }, notes: "5% in eligible top spend category up to monthly cap." },
            { category: "groceries", rate: 5, rewardType: "cashback_percent", cap: { amount: 500, period: "month" } },
            { category: "gas", rate: 5, rewardType: "cashback_percent", cap: { amount: 500, period: "month" } },
            { category: "travel", rate: 5, rewardType: "cashback_percent", cap: { amount: 500, period: "month" } },
            { category: "transit", rate: 5, rewardType: "cashback_percent", cap: { amount: 500, period: "month" } },
            { category: "drugstores", rate: 5, rewardType: "cashback_percent", cap: { amount: 500, period: "month" } },
            { category: "streaming", rate: 5, rewardType: "cashback_percent", cap: { amount: 500, period: "month" } },
            { category: "general", rate: 1, rewardType: "cashback_percent" }
        ]
    },
    {
        id: "capital-one-savor-cash",
        issuer: "Capital One",
        name: "Capital One Savor Cash Rewards",
        network: "mastercard",
        annualFee: 0,
        rewardRules: [
            { category: "dining", rate: 3, rewardType: "cashback_percent" },
            { category: "groceries", rate: 3, rewardType: "cashback_percent" },
            { category: "streaming", rate: 3, rewardType: "cashback_percent" },
            { category: "general", rate: 1, rewardType: "cashback_percent" }
        ]
    },
    {
        id: "capital-one-venture-rewards",
        issuer: "Capital One",
        name: "Capital One Venture Rewards",
        network: "visa",
        annualFee: 95,
        rewardRules: [
            { category: "travel", rate: 5, rewardType: "miles", notes: "Hotels and rental cars booked through Capital One Travel." },
            { category: "general", rate: 2, rewardType: "miles" }
        ]
    },
    {
        id: "capital-one-venture-x",
        issuer: "Capital One",
        name: "Capital One Venture X Rewards",
        network: "visa",
        annualFee: 395,
        rewardRules: [
            { category: "travel", rate: 5, rewardType: "miles", notes: "Flights booked through Capital One Travel; higher rates may apply to hotels and rental cars." },
            { category: "general", rate: 2, rewardType: "miles" }
        ]
    },
    {
        id: "blue-cash-preferred",
        issuer: "American Express",
        name: "Blue Cash Preferred Card",
        network: "amex",
        annualFee: 95,
        rewardRules: [
            { category: "groceries", rate: 6, rewardType: "cashback_percent", cap: { amount: 6000, period: "year" }, notes: "6% at US supermarkets up to annual cap." },
            { category: "streaming", rate: 6, rewardType: "cashback_percent" },
            { category: "gas", rate: 3, rewardType: "cashback_percent" },
            { category: "transit", rate: 3, rewardType: "cashback_percent" },
            { category: "general", rate: 1, rewardType: "cashback_percent" }
        ]
    },
    {
        id: "blue-cash-everyday",
        issuer: "American Express",
        name: "Blue Cash Everyday Card",
        network: "amex",
        annualFee: 0,
        rewardRules: [
            { category: "groceries", rate: 3, rewardType: "cashback_percent", cap: { amount: 6000, period: "year" } },
            { category: "gas", rate: 3, rewardType: "cashback_percent", cap: { amount: 6000, period: "year" } },
            { category: "general", rate: 1, rewardType: "cashback_percent" }
        ]
    },
    {
        id: "discover-it-cash-back",
        issuer: "Discover",
        name: "Discover it Cash Back",
        network: "discover",
        annualFee: 0,
        rewardRules: [
            { category: "general", rate: 1, rewardType: "cashback_percent", notes: "Rotating category activation is excluded from V1 logic." }
        ]
    },
    {
        id: "wells-fargo-active-cash",
        issuer: "Wells Fargo",
        name: "Wells Fargo Active Cash",
        network: "visa",
        annualFee: 0,
        rewardRules: [{ category: "general", rate: 2, rewardType: "cashback_percent" }]
    },
    {
        id: "wells-fargo-autograph",
        issuer: "Wells Fargo",
        name: "Wells Fargo Autograph Card",
        network: "visa",
        annualFee: 0,
        rewardRules: [
            { category: "dining", rate: 3, rewardType: "points" },
            { category: "gas", rate: 3, rewardType: "points" },
            { category: "travel", rate: 3, rewardType: "points" },
            { category: "transit", rate: 3, rewardType: "points" },
            { category: "streaming", rate: 3, rewardType: "points" },
            { category: "general", rate: 1, rewardType: "points" }
        ]
    },
    {
        id: "bank-of-america-customized-cash",
        issuer: "Bank of America",
        name: "Bank of America Customized Cash Rewards",
        network: "visa",
        annualFee: 0,
        rewardRules: [
            { category: "gas", rate: 3, rewardType: "cashback_percent", cap: { amount: 2500, period: "quarter" } },
            { category: "dining", rate: 3, rewardType: "cashback_percent", cap: { amount: 2500, period: "quarter" } },
            { category: "travel", rate: 3, rewardType: "cashback_percent", cap: { amount: 2500, period: "quarter" } },
            { category: "groceries", rate: 2, rewardType: "cashback_percent", cap: { amount: 2500, period: "quarter" } },
            { category: "general", rate: 1, rewardType: "cashback_percent" }
        ]
    },
    {
        id: "us-bank-altitude-go",
        issuer: "U.S. Bank",
        name: "U.S. Bank Altitude Go Visa Signature",
        network: "visa",
        annualFee: 0,
        rewardRules: [
            { category: "dining", rate: 4, rewardType: "points" },
            { category: "groceries", rate: 2, rewardType: "points" },
            { category: "gas", rate: 2, rewardType: "points" },
            { category: "streaming", rate: 2, rewardType: "points" },
            { category: "general", rate: 1, rewardType: "points" }
        ]
    },
    {
        id: "us-bank-cash-plus",
        issuer: "U.S. Bank",
        name: "U.S. Bank Cash+ Visa Signature",
        network: "visa",
        annualFee: 0,
        rewardRules: [
            { category: "streaming", rate: 5, rewardType: "cashback_percent", cap: { amount: 2000, period: "quarter" }, notes: "Requires selected bonus category." },
            { category: "transit", rate: 5, rewardType: "cashback_percent", cap: { amount: 2000, period: "quarter" }, notes: "Ground transportation category when selected." },
            { category: "groceries", rate: 2, rewardType: "cashback_percent" },
            { category: "gas", rate: 2, rewardType: "cashback_percent" },
            { category: "dining", rate: 2, rewardType: "cashback_percent" },
            { category: "general", rate: 1, rewardType: "cashback_percent" }
        ]
    },
    {
        id: "bilt-mastercard",
        issuer: "Wells Fargo",
        name: "Bilt Mastercard",
        network: "mastercard",
        annualFee: 0,
        rewardRules: [
            { category: "dining", rate: 3, rewardType: "points" },
            { category: "travel", rate: 2, rewardType: "points" },
            { category: "general", rate: 1, rewardType: "points", notes: "Requires at least five monthly transactions to earn rewards." }
        ]
    },
    {
        id: "apple-card",
        issuer: "Goldman Sachs",
        name: "Apple Card",
        network: "mastercard",
        annualFee: 0,
        rewardRules: [{ category: "general", rate: 2, rewardType: "cashback_percent", notes: "Assumes Apple Pay purchase." }]
    },
    {
        id: "paypal-cashback-mastercard",
        issuer: "Synchrony",
        name: "PayPal Cashback Mastercard",
        network: "mastercard",
        annualFee: 0,
        rewardRules: [{ category: "general", rate: 2, rewardType: "cashback_percent" }]
    },
    {
        id: "amazon-prime-visa",
        issuer: "Chase",
        name: "Prime Visa",
        network: "visa",
        annualFee: 0,
        rewardRules: [
            { category: "gas", rate: 2, rewardType: "cashback_percent" },
            { category: "dining", rate: 2, rewardType: "cashback_percent" },
            { category: "transit", rate: 2, rewardType: "cashback_percent" },
            { category: "general", rate: 1, rewardType: "cashback_percent" }
        ]
    },
    {
        id: "costco-anywhere-visa",
        issuer: "Citi",
        name: "Costco Anywhere Visa Card",
        network: "visa",
        annualFee: 0,
        rewardRules: [
            { category: "gas", rate: 4, rewardType: "cashback_percent", cap: { amount: 7000, period: "year" } },
            { category: "travel", rate: 3, rewardType: "cashback_percent" },
            { category: "dining", rate: 3, rewardType: "cashback_percent" },
            { category: "general", rate: 1, rewardType: "cashback_percent" }
        ]
    },
    {
        id: "aaa-daily-advantage",
        issuer: "Comenity",
        name: "AAA Daily Advantage Visa Signature",
        network: "visa",
        annualFee: 0,
        rewardRules: [
            { category: "groceries", rate: 5, rewardType: "cashback_percent", cap: { amount: 10000, period: "year" } },
            { category: "gas", rate: 3, rewardType: "cashback_percent" },
            { category: "drugstores", rate: 3, rewardType: "cashback_percent" },
            { category: "streaming", rate: 3, rewardType: "cashback_percent" },
            { category: "general", rate: 1, rewardType: "cashback_percent" }
        ]
    },
    {
        id: "navy-federal-more-rewards",
        issuer: "Navy Federal Credit Union",
        name: "Navy Federal More Rewards American Express",
        network: "amex",
        annualFee: 0,
        rewardRules: [
            { category: "dining", rate: 3, rewardType: "points" },
            { category: "groceries", rate: 3, rewardType: "points" },
            { category: "gas", rate: 3, rewardType: "points" },
            { category: "transit", rate: 3, rewardType: "points" },
            { category: "general", rate: 1, rewardType: "points" }
        ]
    },
    {
        id: "sofi-credit-card",
        issuer: "SoFi",
        name: "SoFi Credit Card",
        network: "mastercard",
        annualFee: 0,
        rewardRules: [{ category: "general", rate: 2, rewardType: "cashback_percent" }]
    },
    {
        id: "fidelity-rewards-visa",
        issuer: "Elan Financial Services",
        name: "Fidelity Rewards Visa Signature",
        network: "visa",
        annualFee: 0,
        rewardRules: [{ category: "general", rate: 2, rewardType: "cashback_percent" }]
    }
];
export const cardIds = new Set(cards.map((card) => card.id));
