using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hamper.Api.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "archived_shops",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    Name = table.Column<string>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<string>(type: "TEXT", nullable: false),
                    ArchivedAt = table.Column<string>(type: "TEXT", nullable: false),
                    PlanStartDate = table.Column<DateOnly>(type: "TEXT", nullable: true),
                    PlanLengthDays = table.Column<int>(type: "INTEGER", nullable: true),
                    Meals = table.Column<string>(type: "TEXT", nullable: false),
                    Lines = table.Column<string>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_archived_shops", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "items",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    Revision = table.Column<long>(type: "INTEGER", nullable: false),
                    DeletedAt = table.Column<string>(type: "TEXT", nullable: true),
                    Name = table.Column<string>(type: "TEXT", maxLength: 200, nullable: false),
                    Size = table.Column<string>(type: "TEXT", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_items", x => x.Id);
                    table.CheckConstraint("CK_items_name", "length(\"Name\") BETWEEN 1 AND 200");
                    table.CheckConstraint("CK_items_size", "\"Size\" IS NULL OR length(\"Size\") <= 100");
                });

            migrationBuilder.CreateTable(
                name: "meals",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    Revision = table.Column<long>(type: "INTEGER", nullable: false),
                    DeletedAt = table.Column<string>(type: "TEXT", nullable: true),
                    Name = table.Column<string>(type: "TEXT", maxLength: 200, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_meals", x => x.Id);
                    table.CheckConstraint("CK_meals_name", "length(\"Name\") BETWEEN 1 AND 200");
                });

            migrationBuilder.CreateTable(
                name: "plan",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    Revision = table.Column<long>(type: "INTEGER", nullable: false),
                    DeletedAt = table.Column<string>(type: "TEXT", nullable: true),
                    StartDate = table.Column<DateOnly>(type: "TEXT", nullable: false),
                    LengthDays = table.Column<int>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_plan", x => x.Id);
                    table.CheckConstraint("CK_plan_length_days", "\"LengthDays\" BETWEEN 1 AND 31");
                });

            migrationBuilder.CreateTable(
                name: "shops",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    Revision = table.Column<long>(type: "INTEGER", nullable: false),
                    DeletedAt = table.Column<string>(type: "TEXT", nullable: true),
                    Name = table.Column<string>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<string>(type: "TEXT", nullable: false),
                    FromPlan = table.Column<bool>(type: "INTEGER", nullable: false),
                    PlanStartDate = table.Column<DateOnly>(type: "TEXT", nullable: true),
                    PlanLengthDays = table.Column<int>(type: "INTEGER", nullable: true),
                    Meals = table.Column<string>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_shops", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "sync_state",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false),
                    CurrentRevision = table.Column<long>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_sync_state", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "wanted_lines",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    Revision = table.Column<long>(type: "INTEGER", nullable: false),
                    DeletedAt = table.Column<string>(type: "TEXT", nullable: true),
                    ItemId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Count = table.Column<int>(type: "INTEGER", nullable: false),
                    Weekly = table.Column<bool>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_wanted_lines", x => x.Id);
                    table.CheckConstraint("CK_wanted_lines_count", "\"Count\" >= 1");
                    table.ForeignKey(
                        name: "FK_wanted_lines_items_ItemId",
                        column: x => x.ItemId,
                        principalTable: "items",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "days",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    Revision = table.Column<long>(type: "INTEGER", nullable: false),
                    DeletedAt = table.Column<string>(type: "TEXT", nullable: true),
                    Position = table.Column<int>(type: "INTEGER", nullable: false),
                    Name = table.Column<string>(type: "TEXT", nullable: false),
                    MealId = table.Column<Guid>(type: "TEXT", nullable: true)
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
                name: "meal_lines",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    Revision = table.Column<long>(type: "INTEGER", nullable: false),
                    DeletedAt = table.Column<string>(type: "TEXT", nullable: true),
                    MealId = table.Column<Guid>(type: "TEXT", nullable: false),
                    ItemId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Count = table.Column<int>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_meal_lines", x => x.Id);
                    table.CheckConstraint("CK_meal_lines_count", "\"Count\" >= 1");
                    table.ForeignKey(
                        name: "FK_meal_lines_items_ItemId",
                        column: x => x.ItemId,
                        principalTable: "items",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_meal_lines_meals_MealId",
                        column: x => x.MealId,
                        principalTable: "meals",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "shop_lines",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    Revision = table.Column<long>(type: "INTEGER", nullable: false),
                    DeletedAt = table.Column<string>(type: "TEXT", nullable: true),
                    ShopId = table.Column<Guid>(type: "TEXT", nullable: false),
                    ItemId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Count = table.Column<int>(type: "INTEGER", nullable: false),
                    NameOverride = table.Column<string>(type: "TEXT", nullable: true),
                    SizeOverride = table.Column<string>(type: "TEXT", nullable: true),
                    Sources = table.Column<string>(type: "TEXT", nullable: false),
                    Ticked = table.Column<bool>(type: "INTEGER", nullable: false),
                    CreatedAt = table.Column<string>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_shop_lines", x => x.Id);
                    table.CheckConstraint("CK_shop_lines_count", "\"Count\" >= 1");
                    table.ForeignKey(
                        name: "FK_shop_lines_items_ItemId",
                        column: x => x.ItemId,
                        principalTable: "items",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_shop_lines_shops_ShopId",
                        column: x => x.ShopId,
                        principalTable: "shops",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "day_lines",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    Revision = table.Column<long>(type: "INTEGER", nullable: false),
                    DeletedAt = table.Column<string>(type: "TEXT", nullable: true),
                    DayId = table.Column<Guid>(type: "TEXT", nullable: false),
                    ItemId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Count = table.Column<int>(type: "INTEGER", nullable: false)
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

            migrationBuilder.InsertData(
                table: "sync_state",
                columns: new[] { "Id", "CurrentRevision" },
                values: new object[] { 1, 0L });

            migrationBuilder.CreateIndex(
                name: "IX_archived_shops_ArchivedAt",
                table: "archived_shops",
                column: "ArchivedAt");

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

            migrationBuilder.CreateIndex(
                name: "IX_items_Revision",
                table: "items",
                column: "Revision");

            migrationBuilder.CreateIndex(
                name: "IX_meal_lines_ItemId",
                table: "meal_lines",
                column: "ItemId");

            migrationBuilder.CreateIndex(
                name: "IX_meal_lines_MealId",
                table: "meal_lines",
                column: "MealId");

            migrationBuilder.CreateIndex(
                name: "IX_meal_lines_Revision",
                table: "meal_lines",
                column: "Revision");

            migrationBuilder.CreateIndex(
                name: "IX_meals_Revision",
                table: "meals",
                column: "Revision");

            migrationBuilder.CreateIndex(
                name: "IX_plan_Revision",
                table: "plan",
                column: "Revision");

            migrationBuilder.CreateIndex(
                name: "IX_shop_lines_ItemId",
                table: "shop_lines",
                column: "ItemId");

            migrationBuilder.CreateIndex(
                name: "IX_shop_lines_Revision",
                table: "shop_lines",
                column: "Revision");

            migrationBuilder.CreateIndex(
                name: "IX_shop_lines_ShopId",
                table: "shop_lines",
                column: "ShopId");

            migrationBuilder.CreateIndex(
                name: "IX_shops_Revision",
                table: "shops",
                column: "Revision");

            migrationBuilder.CreateIndex(
                name: "IX_wanted_lines_ItemId",
                table: "wanted_lines",
                column: "ItemId");

            migrationBuilder.CreateIndex(
                name: "IX_wanted_lines_Revision",
                table: "wanted_lines",
                column: "Revision");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "archived_shops");

            migrationBuilder.DropTable(
                name: "day_lines");

            migrationBuilder.DropTable(
                name: "meal_lines");

            migrationBuilder.DropTable(
                name: "plan");

            migrationBuilder.DropTable(
                name: "shop_lines");

            migrationBuilder.DropTable(
                name: "sync_state");

            migrationBuilder.DropTable(
                name: "wanted_lines");

            migrationBuilder.DropTable(
                name: "days");

            migrationBuilder.DropTable(
                name: "shops");

            migrationBuilder.DropTable(
                name: "items");

            migrationBuilder.DropTable(
                name: "meals");
        }
    }
}
