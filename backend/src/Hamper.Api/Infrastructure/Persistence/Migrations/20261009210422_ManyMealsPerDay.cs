using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hamper.Api.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ManyMealsPerDay : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "planned_meals",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    Revision = table.Column<long>(type: "INTEGER", nullable: false),
                    DeletedAt = table.Column<string>(type: "TEXT", nullable: true),
                    Position = table.Column<int>(type: "INTEGER", nullable: false),
                    Rank = table.Column<int>(type: "INTEGER", nullable: false),
                    Name = table.Column<string>(type: "TEXT", maxLength: 200, nullable: false),
                    MealId = table.Column<Guid>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_planned_meals", x => x.Id);
                    table.CheckConstraint("CK_planned_meals_name", "length(\"Name\") BETWEEN 1 AND 200");
                    table.CheckConstraint("CK_planned_meals_position", "\"Position\" >= 0");
                    table.CheckConstraint("CK_planned_meals_rank", "\"Rank\" >= 0");
                    table.ForeignKey(
                        name: "FK_planned_meals_meals_MealId",
                        column: x => x.MealId,
                        principalTable: "meals",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "planned_meal_lines",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    Revision = table.Column<long>(type: "INTEGER", nullable: false),
                    DeletedAt = table.Column<string>(type: "TEXT", nullable: true),
                    PlannedMealId = table.Column<Guid>(type: "TEXT", nullable: false),
                    ItemId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Count = table.Column<int>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_planned_meal_lines", x => x.Id);
                    table.CheckConstraint("CK_planned_meal_lines_count", "\"Count\" >= 1");
                    table.ForeignKey(
                        name: "FK_planned_meal_lines_items_ItemId",
                        column: x => x.ItemId,
                        principalTable: "items",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_planned_meal_lines_planned_meals_PlannedMealId",
                        column: x => x.PlannedMealId,
                        principalTable: "planned_meals",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_planned_meal_lines_ItemId",
                table: "planned_meal_lines",
                column: "ItemId");

            migrationBuilder.CreateIndex(
                name: "IX_planned_meal_lines_PlannedMealId",
                table: "planned_meal_lines",
                column: "PlannedMealId");

            migrationBuilder.CreateIndex(
                name: "IX_planned_meal_lines_Revision",
                table: "planned_meal_lines",
                column: "Revision");

            migrationBuilder.CreateIndex(
                name: "IX_planned_meals_MealId",
                table: "planned_meals",
                column: "MealId");

            migrationBuilder.CreateIndex(
                name: "IX_planned_meals_Revision",
                table: "planned_meals",
                column: "Revision");

            // Every day becomes the first planned meal of its position, under the same id and revision; a name is cut to the new maximum.
            migrationBuilder.Sql(
                """
                INSERT INTO "planned_meals" ("Id", "Revision", "DeletedAt", "Position", "Rank", "Name", "MealId")
                SELECT "Id", "Revision", "DeletedAt", "Position", 0, substr("Name", 1, 200), "MealId" FROM "days";
                """);
            migrationBuilder.Sql(
                """
                INSERT INTO "planned_meal_lines" ("Id", "Revision", "DeletedAt", "PlannedMealId", "ItemId", "Count")
                SELECT "Id", "Revision", "DeletedAt", "DayId", "ItemId", "Count" FROM "day_lines";
                """);

            migrationBuilder.DropTable(
                name: "day_lines");

            migrationBuilder.DropTable(
                name: "days");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "days",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    DeletedAt = table.Column<string>(type: "TEXT", nullable: true),
                    MealId = table.Column<Guid>(type: "TEXT", nullable: true),
                    Name = table.Column<string>(type: "TEXT", nullable: false),
                    Position = table.Column<int>(type: "INTEGER", nullable: false),
                    Revision = table.Column<long>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_days", x => x.Id);
                    table.CheckConstraint("CK_days_position", "\"Position\" >= 0");
                    table.ForeignKey(
                        name: "FK_days_meals_MealId",
                        column: x => x.MealId,
                        principalTable: "meals",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "day_lines",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    Count = table.Column<int>(type: "INTEGER", nullable: false),
                    DayId = table.Column<Guid>(type: "TEXT", nullable: false),
                    DeletedAt = table.Column<string>(type: "TEXT", nullable: true),
                    ItemId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Revision = table.Column<long>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_day_lines", x => x.Id);
                    table.CheckConstraint("CK_day_lines_count", "\"Count\" >= 1");
                    table.ForeignKey(
                        name: "FK_day_lines_days_DayId",
                        column: x => x.DayId,
                        principalTable: "days",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_day_lines_items_ItemId",
                        column: x => x.ItemId,
                        principalTable: "items",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_day_lines_DayId",
                table: "day_lines",
                column: "DayId");

            migrationBuilder.CreateIndex(
                name: "IX_day_lines_ItemId",
                table: "day_lines",
                column: "ItemId");

            migrationBuilder.CreateIndex(
                name: "IX_day_lines_Revision",
                table: "day_lines",
                column: "Revision");

            migrationBuilder.CreateIndex(
                name: "IX_days_MealId",
                table: "days",
                column: "MealId");

            migrationBuilder.CreateIndex(
                name: "IX_days_Revision",
                table: "days",
                column: "Revision");

            // A day held one meal, so only the first planned meal of each position goes back, with its lines.
            migrationBuilder.Sql(
                """
                INSERT INTO "days" ("Id", "Revision", "DeletedAt", "Position", "Name", "MealId")
                SELECT "Id", "Revision", "DeletedAt", "Position", "Name", "MealId" FROM "planned_meals" WHERE "Rank" = 0;
                """);
            migrationBuilder.Sql(
                """
                INSERT INTO "day_lines" ("Id", "Revision", "DeletedAt", "DayId", "ItemId", "Count")
                SELECT "Id", "Revision", "DeletedAt", "PlannedMealId", "ItemId", "Count" FROM "planned_meal_lines"
                WHERE "PlannedMealId" IN (SELECT "Id" FROM "days");
                """);

            migrationBuilder.DropTable(
                name: "planned_meal_lines");

            migrationBuilder.DropTable(
                name: "planned_meals");
        }
    }
}
