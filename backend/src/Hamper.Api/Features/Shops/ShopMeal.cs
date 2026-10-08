namespace Hamper.Api.Features.Shops;

/// <summary>A planned meal as it stood when a shop was made from the plan, with its library meal id when it had one.</summary>
public sealed record ShopMeal(int Position, string Name, Guid? MealId);
