export const categories = [
    { id: "dining", name: "Dining", description: "Restaurants, cafes, bars, and eligible food delivery." },
    { id: "groceries", name: "Groceries", description: "US supermarkets and grocery stores." },
    { id: "gas", name: "Gas", description: "Gas stations and fuel purchases." },
    { id: "travel", name: "Travel", description: "Flights, hotels, rental cars, and general travel purchases." },
    { id: "transit", name: "Transit", description: "Public transit, rideshare, taxis, tolls, and parking." },
    { id: "drugstores", name: "Drugstores", description: "Pharmacies and drugstore purchases." },
    { id: "streaming", name: "Streaming", description: "Eligible streaming and digital entertainment services." },
    { id: "general", name: "General purchases", description: "Everyday purchases with no category bonus." }
];
export const categoryIds = categories.map((category) => category.id);
