namespace Hamper.Api.Features.Shops;

/// <summary>A planned meal as it stood when a shop was made from the plan: its day, its place in that day's order, its name, and its library meal id when it had one.</summary>
public sealed record ShopMeal(int Position, int Rank, string Name, Guid? MealId)
{
    /// <summary>Orders planned meals by day, then by their place in the day.</summary>
    public static IReadOnlyList<ShopMeal> InPlanOrder(IEnumerable<ShopMeal> meals) =>
        meals.OrderBy(meal => meal.Position).ThenBy(meal => meal.Rank).ToList();
}
