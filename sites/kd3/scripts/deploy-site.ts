import { deploySite } from "@pages/build";
import { site } from "../site.config";

await deploySite(site.deploy);
