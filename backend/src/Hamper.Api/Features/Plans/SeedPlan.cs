using Hamper.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Hamper.Api.Features.Plans;

public static class SeedPlan
{
    /// <summary>Creates the plan row if it is missing, starting today with seven days, and returns the row.</summary>
    public static async Task<Plan> EnsureAsync(HamperDbContext db, TimeProvider time, CancellationToken cancellationToken)
    {
        var existingPlan = await db.Plans.SingleOrDefaultAsync(plan => plan.Id == Plan.SingletonId, cancellationToken);
        if (existingPlan is not null)
        {
            return existingPlan;
        }

        var firstPlan = new Plan
        {
            Id = Plan.SingletonId,
            StartDate = DateOnly.FromDateTime(time.GetLocalNow().DateTime),
            LengthDays = Plan.FirstLengthDays,
        };
        db.Plans.Add(firstPlan);
        await db.SaveChangesAsync(cancellationToken);
        return firstPlan;
    }
}
